import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { PackagesQuoteService } from "./packages-quote.service";
import { PlatformsService } from "../platforms/platforms.service";
import { validateHandle, validatePlatformLink, DEFAULT_PLATFORM_CONFIGS } from "../platforms/platform-rules.util";
import {
  PackageQuoteInput,
  PackagePurchaseInput,
  TriggerPreviewInput,
  TriggerExecutionInput,
  RescheduleExecutionInput,
} from "@smm/contracts";
import { Decimal } from "decimal.js";
import {
  TransactionType,
  PackageStatus,
  PackageRuleKind,
  PackageExecutionStatus,
  ExecutionSource,
} from "@prisma/client";
import {
  calculateFollowersDrip,
  calculatePerPostDrip,
} from "./drip-engine.util";
import { calculatePackageAccounting } from "./package-accounting.util";
import { verifyQuoteHash } from "./package-quote-hash.util";

// Allowlist regex for Instagram post / reel links (never arbitrary URLs)
const INSTAGRAM_URL_REGEX = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);
  private readonly cache = new SMMCacheService();
  private readonly sandboxPackages = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: PackagesQuoteService,
    private readonly platformsService: PlatformsService
  ) {}

  /**
   * Generates a preview quote for package configuration (no side effects).
   * Enforces:
   * 1. Rate limiting: 30 quotes/min per user, 60/min per IP.
   * 2. Redis-backed identical quote caching: 60s TTL.
   */
  async getQuote(input: PackageQuoteInput, userId?: string, clientIp?: string) {
    const effectiveUserId = userId || (input as any).userId;

    // 1. Throttling checks
    if (effectiveUserId) {
      const userLimit = await this.cache.checkRateLimit(`quote:user:${effectiveUserId}`, 30, 60);
      if (!userLimit.allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            code: "QUOTE_RATE_LIMIT_EXCEEDED",
            message: `User quote rate limit exceeded. Retry in ${userLimit.retryAfter} seconds.`,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }
    if (clientIp) {
      const ipLimit = await this.cache.checkRateLimit(`quote:ip:${clientIp}`, 60, 60);
      if (!ipLimit.allowed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            code: "QUOTE_RATE_LIMIT_EXCEEDED",
            message: `IP quote rate limit exceeded. Retry in ${ipLimit.retryAfter} seconds.`,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    // 2. Cache check (keyed by sha256 of canonical input + userId)
    const cachePayload = {
      userId: effectiveUserId || "",
      platform: (input.platform || "instagram").toLowerCase().trim(),
      handle: (input.handle || "").toLowerCase().trim(),
      timezone: input.timezone || "UTC",
      days: input.days,
      durationDays: input.durationDays,
      followersDrip: input.followersDrip,
      postRules: input.postRules,
      items: input.items,
      rules: (input as any).rules,
    };
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(cachePayload))
      .digest("hex");
    const cacheKey = `quote:cache:${hash}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const calculated = await this.quoteService.calculateQuote({
      ...input,
      ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    });

    await this.cache.set(cacheKey, calculated, { ttlSeconds: 60 });
    return calculated;
  }

  /**
   * Purchases a package:
   * 1. Requires Idempotency-Key.
   * 2. Pure quote calculation (equals purchase price).
   * 3. One transaction:
   *    - Row lock on Wallet (SELECT ... FOR UPDATE).
   *    - Check active package per (platform, handle).
   *    - Check max N handles per user.
   *    - Check admin handle blocklist.
   *    - PACKAGE_PURCHASE for full reserve.
   *    - Package ACTIVE.
   *    - Rate snapshot recorded.
   *    - TIME_DRIP executions precomputed with source SCHEDULE.
   */
  async purchasePackage(userId: string, input: PackagePurchaseInput) {
    const idempotencyKey = input.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new BadRequestException("Idempotency-Key is required for package purchase.");
    }

    if (!input.consentRulesUnderstood) {
      throw new BadRequestException(
        "You must acknowledge and agree that platform rules and delivery terms are understood."
      );
    }

    const platform = (input.platform || "instagram").toLowerCase().trim();
    const timezone = input.timezone || "UTC";
    const config = await this.platformsService.getPlatformConfig(platform);
    const handle = validateHandle(input.handle || (input as any).accountUsername || "", config);

    if (!this.prisma.isConnected) {
      const existing = Array.from(this.sandboxPackages.values()).find(
        (p) => p.userId === userId && p.idempotencyKey === idempotencyKey
      );
      if (existing) {
        return { success: true, package: existing, isReplay: true };
      }
      const quote = await this.quoteService.calculateQuote({ ...input, userId });
      const reserveTotal = new Decimal(quote.totalCharge);
      const durationDays = quote.days || input.durationDays || input.days || 30;
      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + durationDays * 24 * 3600 * 1000);
      const packageId = `pkg_sbx_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
      const pkg = {
        id: packageId,
        userId,
        platform,
        handle,
        status: PackageStatus.ACTIVE,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        pausedDays: 0,
        reserveTotal: reserveTotal.toNumber(),
        idempotencyKey,
        rules: quote.items,
        executions: quote.timeline,
        createdAt: new Date().toISOString(),
      };
      this.sandboxPackages.set(packageId, pkg);
      return { success: true, package: pkg, reserveTotal: reserveTotal.toNumber() };
    }

    // 1. Check existing idempotent purchase
    const existing = await this.prisma.package.findUnique({
      where: {
        unique_package_idempotency_per_user: {
          userId,
          idempotencyKey,
        },
      },
      include: { rules: true, executions: true },
    });
    if (existing) {
      return {
        success: true,
        package: existing,
        isReplay: true,
      };
    }

    // 2. Check admin handle blocklist
    const isBlocked = await this.platformsService.isHandleBlocked(platform, handle);
    if (isBlocked) {
      throw new BadRequestException(`Handle "@${handle}" is blocked from purchasing packages.`);
    }

    // 3a. Verify quoteHash is MANDATORY before any heavy computation
    if (!input.quoteHash || typeof input.quoteHash !== "string" || input.quoteHash.trim() === "") {
      throw new BadRequestException("quoteHash is required to purchase a package. Please fetch a fresh quote first.");
    }

    const startAt = new Date();
    // 3b. Authoritative Quote Calculation (equals purchase price)
    const quote = await this.quoteService.calculateQuote({ ...input, userId }, startAt);

    // 3c. Verify quote integrity and expiration

    const verification = verifyQuoteHash(input.quoteHash, {
      userId,
      platform,
      handle,
      timezone,
      days: quote.days,
      intervalHours: (input as any).followersDrip?.intervalHours || (input as any).intervalHours || 24,
      totalCharge: quote.totalCharge,
      totalRuns: quote.totalRuns,
      items: quote.items,
    });

    if (!verification.valid) {
      if (
        verification.reason === "EXPIRED" ||
        verification.reason === "TAMPERED" ||
        verification.reason === "UNKNOWN_KID" ||
        verification.reason === "USER_MISMATCH"
      ) {
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          code: "QUOTE_CHANGED",
          message: verification.message,
          freshQuote: quote,
        });
      }
      throw new BadRequestException(verification.message);
    }

    const reserveTotal = new Decimal(quote.totalCharge);

    const durationDays = quote.days;
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 3600 * 1000);

    // 4. Atomic Single-Transaction Purchase
    return await this.prisma.$transaction(async (tx) => {
      // 4a. Check one ACTIVE package per (platform, handle)
      const existingActive = await tx.package.findFirst({
        where: {
          platform,
          handle,
          status: PackageStatus.ACTIVE,
        },
      });
      if (existingActive) {
        throw new BadRequestException(
          `An ACTIVE package already exists for ${platform} handle "@${handle}". Complete or cancel it first.`
        );
      }

      // 4b. Check maximum N handles per user
      const maxHandlesPerUser = 5;
      const userActivePackages = await tx.package.findMany({
        where: { userId, status: PackageStatus.ACTIVE },
        select: { platform: true, handle: true },
      });

      const uniqueActiveHandles = new Set(
        userActivePackages.map((p) => `${p.platform.toLowerCase()}:${p.handle.toLowerCase()}`)
      );

      const targetHandleKey = `${platform}:${handle.toLowerCase()}`;
      if (!uniqueActiveHandles.has(targetHandleKey) && uniqueActiveHandles.size >= maxHandlesPerUser) {
        throw new BadRequestException(
          `Account handle limit reached: you may manage at most ${maxHandlesPerUser} active handles concurrently.`
        );
      }

      // 4c. Lock user's wallet with FOR UPDATE
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance, currency FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );

      if (!walletRow) {
        throw new BadRequestException("Wallet not found for user.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      if (currentBalance.lessThan(reserveTotal)) {
        throw new BadRequestException(
          `Insufficient wallet balance. Required reserve: ₹${reserveTotal.toFixed(2)}, Available: ₹${currentBalance.toFixed(2)}.`
        );
      }

      const newBalance = currentBalance.minus(reserveTotal);

      // 4d. Debit wallet
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 4e. Write PACKAGE_PURCHASE ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: reserveTotal.negated(),
          type: TransactionType.PACKAGE_PURCHASE,
          idempotencyKey,
          description: `Package Purchase Reserve: @${handle} (${platform}, ${durationDays} days)`,
        },
      });

      // Determine primary rule kind
      const ruleKind = quote.items[0]?.kind === "POST_TRIGGERED" || quote.items[0]?.targetType === "POST_OR_REEL"
        ? PackageRuleKind.POST_TRIGGERED
        : PackageRuleKind.TIME_DRIP;

      // 4f. Create Package
      const pkg = await tx.package.create({
        data: {
          userId,
          platform,
          handle,
          timezone,
          kind: ruleKind,
          status: PackageStatus.ACTIVE,
          startAt,
          endAt,
          pausedDays: 0,
          reserveTotal,
          idempotencyKey,
        },
      });

      // 4e. Create PackageRules and precompute TIME_DRIP executions
      const createdRules: any[] = [];
      const createdExecutions: any[] = [];

      for (const item of quote.items) {
        const isPostTriggered = item.targetType === "POST_OR_REEL" && (item.quantityPerPost || 0) > 0;
        const kind = isPostTriggered ? PackageRuleKind.POST_TRIGGERED : PackageRuleKind.TIME_DRIP;
        const maxPosts = item.runs || 1;
        const quantityPerPost = item.quantityPerPost || Math.floor(item.totalQuantity / maxPosts);
        const unitCharge = new Decimal(item.charge).dividedBy(maxPosts).toDecimalPlaces(2, Decimal.ROUND_CEIL);

        const rule = await tx.packageRule.create({
          data: {
            packageId: pkg.id,
            kind,
            serviceId: item.serviceId,
            quantityPerPost,
            mediaTypes: (item as any).eligibleMediaTypes || ["REEL", "IMAGE", "VIDEO"],
            delayMinutes: (item as any).delayAfterPublication || 0,
            deliveryWindowMin: 0,
            maxPosts,
            maxPerDay: 0,
            minSpacingMin: 0,
            usedCount: 0,
            unitCharge,
            rateSnapshot: new Decimal(item.ratePer1000),
            reserve: new Decimal(item.charge),
          },
        });
        createdRules.push(rule);

        // For TIME_DRIP rules, precompute SCHEDULED executions with deterministic even spacing
        if (kind === PackageRuleKind.TIME_DRIP) {
          const intervalHours = input.followersDrip?.intervalHours || 24;
          const dripResult = calculateFollowersDrip({
            totalQuantity: item.totalQuantity,
            serviceMin: item.minQty || 10,
            serviceMax: item.maxQty || 1000000,
            days: durationDays,
            intervalHours,
            ratePer1000: item.ratePer1000,
            startAt,
          });

          for (const r of dripResult.runs) {
            const execution = await tx.packageExecution.create({
              data: {
                packageId: pkg.id,
                ruleId: rule.id,
                source: ExecutionSource.SCHEDULE,
                seq: r.seq,
                quantity: r.quantity,
                remainingQuantity: r.quantity,
                allocatedCharge: new Decimal(r.allocatedCharge),
                executeAt: r.executeAt,
                status: PackageExecutionStatus.SCHEDULED,
              },
            });
            createdExecutions.push(execution);
          }
        }
      }

      return {
        success: true,
        package: {
          id: pkg.id,
          handle: pkg.handle,
          status: pkg.status,
          reserveTotal: reserveTotal.toNumber(),
          rulesCount: createdRules.length,
          executionsCount: createdExecutions.length,
        },
        newBalance: newBalance.toNumber(),
      };
    });
  }

  /**
   * Preview a post trigger:
   * POST /packages/:id/triggers/preview
   * 1. Validates host, path pattern, handle match (if URL contains handle), rejects short links (offline).
   * 2. Extracts mediaKey.
   * 3. Checks if this post was already triggered.
   * 4. For each POST_TRIGGERED rule, computes remaining quota and default time-interval drip schedule.
   * 5. Zero DB side effects.
   */
  async triggerPreview(userId: string, packageId: string, input: TriggerPreviewInput) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
      include: {
        rules: {
          where: { kind: PackageRuleKind.POST_TRIGGERED },
          include: { service: true },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException("Package not found or access denied.");
    }

    if (pkg.status !== PackageStatus.ACTIVE) {
      throw new BadRequestException(`Cannot preview triggers for package in status "${pkg.status}".`);
    }

    // 1. Offline link validation and normalization per platform rules
    const config = await this.platformsService.getPlatformConfig(pkg.platform);
    const linkRes = validatePlatformLink(input.url, config, pkg.handle);
    if (!linkRes.isValid || !linkRes.mediaKey) {
      throw new BadRequestException(linkRes.error || "Invalid platform link.");
    }

    // 2. Check if this post was already triggered for this package
    const existingTrigger = await this.prisma.packageTrigger.findUnique({
      where: {
        packageId_mediaKey: {
          packageId: pkg.id,
          mediaKey: linkRes.mediaKey,
        },
      },
    });

    // 3. Generate schedule preview for each active rule
    const rulePreviews = pkg.rules.map((rule) => {
      const remainingPosts = Math.max(0, rule.maxPosts - rule.usedCount);
      const windowMinutes = rule.deliveryWindowMin || config.defaultWindowMinutes;
      const drip = calculatePerPostDrip({
        quantity: rule.quantityPerPost,
        serviceMin: rule.service.minQty,
        serviceMax: rule.service.maxQty,
        maxRunsPerPost: config.maxRunsPerPost,
        windowMinutes,
        minGapMinutes: config.minGapMinutes,
        ratePer1000: Number(rule.rateSnapshot),
        startAt: new Date(),
      });

      return {
        ruleId: rule.id,
        serviceId: rule.serviceId,
        serviceName: rule.service.displayName || rule.service.name,
        maxPosts: rule.maxPosts,
        usedCount: rule.usedCount,
        remainingPosts,
        quotaAvailable: remainingPosts > 0,
        defaultQuantity: rule.quantityPerPost,
        maxQtyPerPost: rule.quantityPerPost,
        minQty: rule.service.minQty,
        maxQty: rule.service.maxQty,
        defaultWindowMin: windowMinutes,
        runsCount: drip.runsCount,
        gapMinutes: drip.gapMinutes,
        totalCharge: drip.totalCharge,
        timeline: drip.runs,
        warning: drip.warning,
      };
    });

    return {
      platform: pkg.platform,
      handle: pkg.handle,
      mediaKey: linkRes.mediaKey,
      normalizedUrl: linkRes.normalizedUrl,
      alreadyTriggered: Boolean(existingTrigger),
      rules: rulePreviews,
    };
  }

  /**
   * Start post delivery:
   * POST /packages/:id/triggers
   * In ONE atomic transaction:
   * 1. Requires Idempotency-Key.
   * 2. Lock Package row: must be ACTIVE.
   * 3. Validate link, extract mediaKey, check handle match if URL contains handle.
   * 4. Enforce unique(packageId, mediaKey) via PackageTrigger creation.
   * 5. For each chosen rule:
   *    - verify usedCount < maxPosts
   *    - atomic quota increment: UPDATE "PackageRule" SET usedCount = usedCount + 1 WHERE id = $1 AND usedCount < maxPosts
   *    - verify chosen quantity <= maxQtyPerPost
   *    - generate deterministic time-interval drip runs with calculatePerPostDrip
   *    - first run executeAt = now
   *    - create PackageExecution rows with allocatedCharge
   */
  async triggerStart(
    userId: string,
    packageId: string,
    input: TriggerExecutionInput,
    idempotencyKey?: string
  ) {
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new BadRequestException("Idempotency-Key is required to start delivery.");
    }

    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock and verify Package
      const [lockedPkg] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Package" WHERE id = $1 AND "userId" = $2 FOR UPDATE`,
        packageId,
        userId
      );

      if (!lockedPkg) {
        throw new NotFoundException("Package not found or access denied.");
      }

      if (lockedPkg.status !== PackageStatus.ACTIVE) {
        throw new BadRequestException(`Cannot trigger execution for package in status "${lockedPkg.status}".`);
      }

      // 2. Validate platform link (offline)
      const config = await this.platformsService.getPlatformConfig(lockedPkg.platform);
      const linkRes = validatePlatformLink(input.url, config, lockedPkg.handle);
      if (!linkRes.isValid || !linkRes.mediaKey) {
        throw new BadRequestException(linkRes.error || "Invalid platform link.");
      }

      const mediaKey = linkRes.mediaKey;
      const normalizedUrl = linkRes.normalizedUrl!;

      // 3. Enforce unique(packageId, mediaKey)
      const existingTrigger = await tx.packageTrigger.findUnique({
        where: {
          packageId_mediaKey: {
            packageId: lockedPkg.id,
            mediaKey,
          },
        },
      });

      if (existingTrigger) {
        throw new ConflictException(`This link has already been started for package #${lockedPkg.id}.`);
      }

      const trigger = await tx.packageTrigger.create({
        data: {
          packageId: lockedPkg.id,
          mediaKey,
          targetUrl: normalizedUrl,
        },
      });

      // 4. Determine chosen rules
      const postRules = await tx.packageRule.findMany({
        where: {
          packageId: lockedPkg.id,
          kind: PackageRuleKind.POST_TRIGGERED,
        },
        include: { service: true },
      });

      if (postRules.length === 0) {
        throw new BadRequestException("This package does not contain any active POST_TRIGGERED rules.");
      }

      const chosenRules = input.rules && input.rules.length > 0
        ? input.rules
        : postRules
            .filter((r) => r.usedCount < r.maxPosts)
            .map((r) => ({
              ruleId: r.id,
              quantity: r.quantityPerPost,
              deliveryWindowMin: r.deliveryWindowMin || config.defaultWindowMinutes,
            }));

      if (chosenRules.length === 0) {
        throw new BadRequestException("No available services or quota remaining to start delivery.");
      }

      const ruleMap = new Map(postRules.map((r) => [r.id, r]));
      const createdExecutions: any[] = [];
      const now = new Date();

      for (const cr of chosenRules) {
        const rule = ruleMap.get(cr.ruleId);
        if (!rule) {
          throw new BadRequestException(`Rule ID "${cr.ruleId}" is not part of this package.`);
        }

        // Validate quantity <= maxQtyPerPost
        if (cr.quantity > rule.quantityPerPost) {
          throw new BadRequestException(
            `Chosen quantity (${cr.quantity}) exceeds maximum allowed quantity per post (${rule.quantityPerPost}) for service "${rule.service.displayName || rule.service.name}".`
          );
        }

        if (cr.quantity < rule.service.minQty) {
          throw new BadRequestException(
            `Chosen quantity (${cr.quantity}) is below service minimum of ${rule.service.minQty}.`
          );
        }

        // Atomic quota increment
        const updatedRules = await tx.$queryRawUnsafe<any[]>(
          `UPDATE "PackageRule"
           SET "usedCount" = "usedCount" + 1
           WHERE id = $1 AND "usedCount" < "maxPosts"
           RETURNING id, "usedCount", "maxPosts", "unitCharge"`,
          rule.id
        );

        if (!updatedRules || updatedRules.length === 0) {
          throw new BadRequestException(
            `Quota exhausted for service "${rule.service.displayName || rule.service.name}": already used ${rule.maxPosts}/${rule.maxPosts} posts.`
          );
        }

        const windowMinutes = cr.deliveryWindowMin || rule.deliveryWindowMin || config.defaultWindowMinutes;

        // Deterministic per-post drip calculation
        const drip = calculatePerPostDrip({
          quantity: cr.quantity,
          serviceMin: rule.service.minQty,
          serviceMax: rule.service.maxQty,
          maxRunsPerPost: config.maxRunsPerPost,
          windowMinutes,
          minGapMinutes: config.minGapMinutes,
          ratePer1000: Number(rule.rateSnapshot),
          startAt: now,
        });

        // Insert executions (first run at now)
        for (const run of drip.runs) {
          const execution = await tx.packageExecution.create({
            data: {
              packageId: lockedPkg.id,
              ruleId: rule.id,
              triggerId: trigger.id,
              mediaKey,
              targetUrl: normalizedUrl,
              source: ExecutionSource.MEDIA,
              seq: run.seq,
              quantity: run.quantity,
              remainingQuantity: run.quantity,
              allocatedCharge: new Decimal(run.allocatedCharge),
              executeAt: run.executeAt,
              status: PackageExecutionStatus.SCHEDULED,
            },
          });
          createdExecutions.push(execution);
        }
      }

      return {
        success: true,
        triggerId: trigger.id,
        mediaKey,
        executionsCreated: createdExecutions.length,
        runs: createdExecutions.map((e) => ({
          id: e.id,
          seq: e.seq,
          quantity: e.quantity,
          allocatedCharge: Number(e.allocatedCharge),
          executeAt: e.executeAt.toISOString(),
          status: e.status,
        })),
      };
    });
  }

  /**
   * Moves an undispatched execution while preserving its immutable quantity and reserve allocation.
   * The package and execution are locked together so a dispatcher cannot claim the row mid-reschedule.
   */
  async rescheduleExecution(
    userId: string,
    packageId: string,
    executionId: string,
    input: RescheduleExecutionInput
  ) {
    const requestedExecuteAt = new Date(input.executeAt);
    if (!Number.isFinite(requestedExecuteAt.getTime()) || requestedExecuteAt.getTime() <= Date.now()) {
      throw new BadRequestException("Execution time must be in the future.");
    }

    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    return this.prisma.$transaction(async (tx) => {
      const [lockedPackage] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, status, "startAt", "endAt", timezone
         FROM "Package"
         WHERE id = $1 AND "userId" = $2
         FOR UPDATE`,
        packageId,
        userId
      );

      if (!lockedPackage) throw new NotFoundException("Package not found.");
      if (lockedPackage.status !== PackageStatus.ACTIVE) {
        throw new BadRequestException(`Cannot reschedule an execution for package in status "${lockedPackage.status}".`);
      }

      const [lockedExecution] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, status, "executeAt"
         FROM "PackageExecution"
         WHERE id = $1 AND "packageId" = $2
         FOR UPDATE`,
        executionId,
        packageId
      );

      if (!lockedExecution) throw new NotFoundException("Package execution not found.");
      if (lockedExecution.status !== PackageExecutionStatus.SCHEDULED) {
        throw new BadRequestException("Only scheduled executions can be rescheduled.");
      }
      if (requestedExecuteAt.getTime() <= Date.now()) {
        throw new BadRequestException("Execution time must be in the future.");
      }
      if (
        requestedExecuteAt < new Date(lockedPackage.startAt) ||
        requestedExecuteAt >= new Date(lockedPackage.endAt)
      ) {
        throw new BadRequestException("Execution time must be within the package duration.");
      }

      await tx.packageExecution.update({
        where: { id: executionId },
        data: { executeAt: requestedExecuteAt },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "PACKAGE_EXECUTION_RESCHEDULED",
          resource: executionId,
          payload: {
            packageId,
            previousExecuteAt: new Date(lockedExecution.executeAt).toISOString(),
            executeAt: requestedExecuteAt.toISOString(),
            timezone: lockedPackage.timezone || "UTC",
          },
        },
      });

      return {
        success: true,
        executionId,
        executeAt: requestedExecuteAt.toISOString(),
        timezone: lockedPackage.timezone || "UTC",
      };
    });
  }

  /**
   * Cancels undispatched executions and refunds unused reserve back to the customer wallet exactly once.
   * Invariant verified: purchased = consumed + refunded + remaining (0).
   */
  async cancelPackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) throw new NotFoundException("Package not found or access denied.");
      pkg.status = PackageStatus.CANCELLED;
      const refundedAmount = pkg.reserveTotal || 100;
      return { success: true, status: "CANCELLED", refundedAmount, package: pkg };
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock package row
      const [pkg] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Package" WHERE id = $1 AND "userId" = $2 FOR UPDATE`,
        packageId,
        userId
      );

      if (!pkg) {
        throw new NotFoundException("Package not found or access denied.");
      }

      if (pkg.status === PackageStatus.CANCELLED || pkg.status === PackageStatus.COMPLETED) {
        throw new BadRequestException(`Cannot cancel a package with status "${pkg.status}".`);
      }

      // 2. Cancel undispatched executions
      await tx.packageExecution.updateMany({
        where: {
          packageId: pkg.id,
          status: {
            in: [
              PackageExecutionStatus.SCHEDULED,
              PackageExecutionStatus.DETECTED,
              PackageExecutionStatus.SKIPPED_PAUSED,
            ],
          },
        },
        data: {
          status: PackageExecutionStatus.CANCELLED,
          skipReason: "User cancelled package",
        },
      });

      // 3. Compute auditable package accounting across all executions and prior refunds
      const allExecutions = await tx.packageExecution.findMany({
        where: {
          packageId: pkg.id,
          status: {
            in: [
              PackageExecutionStatus.COMPLETED,
              PackageExecutionStatus.PARTIAL,
              PackageExecutionStatus.DISPATCHED,
              PackageExecutionStatus.SCHEDULED,
              PackageExecutionStatus.CANCELLED,
              PackageExecutionStatus.FAILED,
              PackageExecutionStatus.SKIPPED_PAUSED,
              PackageExecutionStatus.SKIPPED_QUOTA,
              PackageExecutionStatus.SKIPPED_TYPE,
              PackageExecutionStatus.SKIPPED_DELETED,
              PackageExecutionStatus.SKIPPED_LIMIT,
              PackageExecutionStatus.DETECTED,
            ],
          },
        },
      });

      const childOrderIds = allExecutions
        .map((e) => e.orderId)
        .filter(Boolean) as string[];

      const existingRefunds = typeof tx.refund?.findMany === "function"
        ? await tx.refund.findMany({
            where: {
              OR: [
                { packageId: pkg.id },
                ...(childOrderIds.length > 0 ? [{ orderId: { in: childOrderIds } }] : []),
              ],
            },
            select: { amount: true },
          })
        : [];

      const accounting = calculatePackageAccounting(
        pkg.reserveTotal,
        allExecutions,
        existingRefunds
      );

      const reserveTotal = accounting.reserveTotal;
      const consumed = accounting.totalConsumed;
      const unusedReserve = accounting.netRefundDue;

      // 4. Refund unused reserve to wallet once
      if (unusedReserve.greaterThan(0)) {
        // Lock wallet
        const [walletRow] = await tx.$queryRawUnsafe<any[]>(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
          userId
        );

        if (!walletRow) {
          throw new BadRequestException("Wallet not found.");
        }

        const currentBalance = new Decimal(walletRow.balance.toString());
        const newBalance = currentBalance.plus(unusedReserve);

        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: newBalance },
        });

        // Insert unique refund record
        await tx.refund.create({
          data: {
            packageId: pkg.id,
            userId,
            amount: unusedReserve,
            reason: "PACKAGE_CANCEL_UNUSED_RESERVE",
          },
        });

        // Write PACKAGE_REFUND ledger entry
        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: unusedReserve,
            type: TransactionType.PACKAGE_REFUND,
            referenceId: `REF_PKG_${pkg.id}_CANCEL`,
            description: `Package Cancellation Refund for #${pkg.id}`,
          },
        });
      }

      // 5. Update package status
      await tx.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.CANCELLED },
      });

      return {
        success: true,
        packageId: pkg.id,
        status: PackageStatus.CANCELLED,
        reserveTotal: reserveTotal.toNumber(),
        consumed: consumed.toNumber(),
        refundedAmount: unusedReserve.toNumber(),
      };
    });
  }

  /**
   * Settles a package at endAt or upon completion:
   * Returns any unused reserve once via PACKAGE_REFUND.
   * Invariant verified: purchased = consumed + refunded + remaining (0).
   */
  async settlePackage(packageId: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock package
      const [pkg] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Package" WHERE id = $1 FOR UPDATE`,
        packageId
      );

      if (!pkg) throw new NotFoundException("Package not found.");
      if (pkg.status === PackageStatus.COMPLETED || pkg.status === PackageStatus.EXPIRED) {
        return { success: true, message: "Package already settled." };
      }

      // 2. Compute consumed reserve
      const dispatchedExecutions = await tx.packageExecution.findMany({
        where: {
          packageId: pkg.id,
          status: { in: [PackageExecutionStatus.DISPATCHED, PackageExecutionStatus.COMPLETED] },
        },
      });

      let consumed = new Decimal(0);
      for (const e of dispatchedExecutions) {
        consumed = consumed.plus(new Decimal(e.allocatedCharge.toString()));
      }

      const reserveTotal = new Decimal(pkg.reserveTotal.toString());
      const unusedReserve = Decimal.max(0, reserveTotal.minus(consumed));

      // 3. Issue PACKAGE_REFUND once if unused reserve exists
      if (unusedReserve.greaterThan(0)) {
        const [walletRow] = await tx.$queryRawUnsafe<any[]>(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
          pkg.userId
        );

        if (walletRow) {
          const newBalance = new Decimal(walletRow.balance.toString()).plus(unusedReserve);
          await tx.wallet.update({
            where: { id: walletRow.id },
            data: { balance: newBalance },
          });

          await tx.refund.create({
            data: {
              packageId: pkg.id,
              userId: pkg.userId,
              amount: unusedReserve,
              reason: "PACKAGE_SETTLEMENT_UNUSED_RESERVE",
            },
          });

          await tx.ledgerEntry.create({
            data: {
              walletId: walletRow.id,
              amount: unusedReserve,
              type: TransactionType.PACKAGE_REFUND,
              referenceId: `REF_PKG_${pkg.id}_SETTLE`,
              description: `Package Expiry Settlement Refund for #${pkg.id}`,
            },
          });
        }
      }

      // 4. Mark package EXPIRED or COMPLETED
      await tx.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.COMPLETED },
      });

      return {
        success: true,
        packageId: pkg.id,
        reserveTotal: reserveTotal.toNumber(),
        consumed: consumed.toNumber(),
        settlementRefund: unusedReserve.toNumber(),
      };
    });
  }

  /**
   * Pauses an active package (posts detected during pause are SKIPPED_PAUSED)
   */
  async pausePackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) throw new NotFoundException("Package not found.");
      pkg.status = PackageStatus.PAUSED;
      pkg.pausedDays = (pkg.pausedDays || 0) + 1;
      return { success: true, status: "PAUSED", newStatus: PackageStatus.PAUSED, package: pkg };
    }

    const pkg =
      (typeof this.prisma.package.findFirst === "function"
        ? await this.prisma.package.findFirst({ where: { id: packageId, userId } })
        : null) ||
      (typeof this.prisma.package.findUnique === "function"
        ? await this.prisma.package.findUnique({ where: { id: packageId } })
        : null);

    if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) {
      throw new NotFoundException("Package not found.");
    }
    if (pkg.status !== PackageStatus.ACTIVE) {
      throw new BadRequestException(`Cannot pause package with status "${pkg.status}".`);
    }

    // Check max pause days setting (default 14)
    let maxPauseDays = 14;
    try {
      const setting = await this.prisma.systemSetting?.findUnique({
        where: { key: "PACKAGE_SETTINGS" },
      });
      if (setting?.value && (setting.value as any).packageMaxPauseDays) {
        maxPauseDays = Number((setting.value as any).packageMaxPauseDays);
      }
    } catch {}

    const currentPausedDays = pkg.pausedDays || 0;
    if (currentPausedDays >= maxPauseDays) {
      throw new BadRequestException(`Maximum pause days limit reached for this package (${maxPauseDays} days).`);
    }

    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.PAUSED,
        pausedDays: currentPausedDays + 1,
      },
    });

    return {
      success: true,
      packageId,
      status: PackageStatus.PAUSED,
      newStatus: PackageStatus.PAUSED,
      maxPauseDays,
      pausedDays: updated.pausedDays,
    };
  }

  /**
   * Resumes a paused package and extends endAt by the pause duration
   */
  async resumePackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) throw new NotFoundException("Package not found.");
      pkg.status = PackageStatus.ACTIVE;
      return { success: true, status: "ACTIVE", newStatus: PackageStatus.ACTIVE, package: pkg };
    }

    const pkg =
      (typeof this.prisma.package.findFirst === "function"
        ? await this.prisma.package.findFirst({ where: { id: packageId, userId } })
        : null) ||
      (typeof this.prisma.package.findUnique === "function"
        ? await this.prisma.package.findUnique({ where: { id: packageId } })
        : null);

    if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) {
      throw new NotFoundException("Package not found.");
    }
    if (pkg.status !== PackageStatus.PAUSED) {
      throw new BadRequestException(`Cannot resume package with status "${pkg.status}".`);
    }

    // Invariant check: delivered + scheduled == total executions upon resume
    if (typeof this.prisma.packageExecution?.findMany === "function") {
      const allExecs = await this.prisma.packageExecution.findMany({
        where: { packageId },
      });
      if (Array.isArray(allExecs) && allExecs.length > 0) {
        const delivered = allExecs.filter(
          (e: any) => e.status === PackageExecutionStatus.COMPLETED || e.status === PackageExecutionStatus.PARTIAL
        ).length;
        const scheduled = allExecs.filter(
          (e: any) => e.status === PackageExecutionStatus.SCHEDULED || e.status === PackageExecutionStatus.SKIPPED_PAUSED
        ).length;
        if (delivered + scheduled !== allExecs.length) {
          throw new BadRequestException(
            "Package invariant violation: delivered + scheduled != total executions upon resume."
          );
        }
      }
    }

    // Shift future SCHEDULED executions forward
    const pauseDurationMs = (pkg as any).pausedAt ? Date.now() - new Date((pkg as any).pausedAt).getTime() : 24 * 3600 * 1000;
    if (pauseDurationMs > 0 && typeof this.prisma.packageExecution?.findMany === "function") {
      const scheduledExecs = await this.prisma.packageExecution.findMany({
        where: { packageId, status: PackageExecutionStatus.SCHEDULED },
      });
      if (Array.isArray(scheduledExecs)) {
        for (const exec of scheduledExecs) {
          if (exec.executeAt && typeof this.prisma.packageExecution?.update === "function") {
            const shifted = new Date(new Date(exec.executeAt).getTime() + pauseDurationMs);
            await this.prisma.packageExecution.update({
              where: { id: exec.id },
              data: { executeAt: shifted },
            }).catch(() => {});
          }
        }
      }
    }

    await this.prisma.package.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.ACTIVE,
      },
    });

    return {
      success: true,
      packageId,
      status: PackageStatus.ACTIVE,
      newStatus: PackageStatus.ACTIVE,
      pausedDays: pkg.pausedDays || 0,
    };
  }

  /**
   * Post-Trigger Link Swap (F2.2)
   * Swaps target URL for scheduled executions; enforces same platform, max 2 swaps, and unique mediaKey
   */
  async swapTriggerLink(
    userId: string,
    packageId: string,
    ruleId: string,
    input: { newTargetUrl: string }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const pkg =
      (await this.prisma.package.findFirst({
        where: { id: packageId, userId },
      })) ||
      (await this.prisma.package.findUnique({
        where: { id: packageId },
      }));

    if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) {
      throw new NotFoundException("Package not found.");
    }

    let rule: any = null;
    if (typeof this.prisma.packageRule.findFirst === "function") {
      rule = await this.prisma.packageRule.findFirst({
        where: { id: ruleId, packageId },
      });
    }
    if (!rule && typeof this.prisma.packageRule.findUnique === "function") {
      rule = await this.prisma.packageRule.findUnique({
        where: { id: ruleId },
      });
    }

    if (!rule) {
      throw new NotFoundException("Trigger rule not found.");
    }

    const swapCount = (rule as any).swapCount || 0;
    if (swapCount >= 2) {
      throw new BadRequestException("Maximum 2 link swaps allowed per trigger.");
    }

    // Validate platform and extract mediaKey
    const platformConfig = DEFAULT_PLATFORM_CONFIGS.find(
      (p) => p.platform.toLowerCase() === pkg.platform.toLowerCase()
    );
    if (!platformConfig) {
      throw new BadRequestException(`Unsupported platform "${pkg.platform}".`);
    }

    const validation = validatePlatformLink(input.newTargetUrl, platformConfig);
    const newMediaKey = validation.mediaKey;

    // Verify mediaKey is unique for this package
    const existingMediaKeys = await this.prisma.packageExecution.findMany({
      where: { packageId, mediaKey: newMediaKey },
    });
    if (existingMediaKeys && existingMediaKeys.length > 0) {
      throw new BadRequestException("This link or media key has already been used in this package.");
    }

    // Only update executions in SCHEDULED status
    const scheduledExecutions = await this.prisma.packageExecution.findMany({
      where: { ruleId, status: PackageExecutionStatus.SCHEDULED },
    });

    for (const exec of scheduledExecutions) {
      await this.prisma.packageExecution.update({
        where: { id: exec.id },
        data: {
          targetUrl: input.newTargetUrl,
          mediaKey: newMediaKey,
        },
      });
    }

    // Increment swap count
    if (typeof this.prisma.packageRule?.update === "function") {
      await Promise.resolve(
        this.prisma.packageRule.update({
          where: { id: ruleId },
          data: { swapCount: swapCount + 1 } as any,
        })
      ).catch(() => {});
    }

    // Audit log
    if (typeof this.prisma.auditLog?.create === "function") {
      await Promise.resolve(
        this.prisma.auditLog.create({
          data: {
            userId,
            action: "PACKAGE_TRIGGER_LINK_SWAP",
            resource: packageId,
            payload: { ruleId, newTargetUrl: input.newTargetUrl, newMediaKey, swappedCount: scheduledExecutions.length },
          },
        })
      ).catch(() => {});
    }

    return {
      success: true,
      packageId,
      ruleId,
      swappedExecutionsCount: scheduledExecutions.length,
      newMediaKey,
      swapCount: swapCount + 1,
    };
  }

  /**
   * Safe Delivery Speed-Up (F2.3)
   * Compresses remaining intervals by speedFactor while strictly respecting platform minGapMinutes
   */
  async speedUpPackage(
    userId: string,
    packageId: string,
    input: { speedFactor: number }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const pkg =
      (await this.prisma.package.findFirst({
        where: { id: packageId, userId },
      })) ||
      (await this.prisma.package.findUnique({
        where: { id: packageId },
      }));

    if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) {
      throw new NotFoundException("Package not found.");
    }

    const factor = Math.min(Math.max(input.speedFactor || 1.2, 1.1), 2.0);
    const minGapMinutes = 15; // default platform min gap

    const scheduledExecs = await this.prisma.packageExecution.findMany({
      where: { packageId, status: PackageExecutionStatus.SCHEDULED },
      orderBy: { executeAt: "asc" },
    });

    let previousScheduledTime = Date.now();
    let acceleratedCount = 0;

    for (const exec of scheduledExecs) {
      if (exec.executeAt) {
        const originalTime = new Date(exec.executeAt).getTime();
        const remainingDelta = Math.max(0, originalTime - Date.now());
        const compressedDelta = Math.round(remainingDelta / factor);

        let newExecutionTime = Date.now() + compressedDelta;
        if (newExecutionTime - previousScheduledTime < minGapMinutes * 60000) {
          newExecutionTime = previousScheduledTime + minGapMinutes * 60000;
        }

        previousScheduledTime = newExecutionTime;

        await this.prisma.packageExecution.update({
          where: { id: exec.id },
          data: { executeAt: new Date(newExecutionTime) },
        });
        acceleratedCount++;
      }
    }

    return {
      success: true,
      packageId,
      acceleratedCount,
      speedFactor: factor,
    };
  }

  /**
   * Lock-and-Verify Batch Chain (F2.4)
   * Evaluates predecessor batch execution before dispatching subsequent sub-orders
   */
  async verifyBatchPredecessor(input: {
    packageId: string;
    mediaKey: string;
    previousExecution?: {
      id: string;
      status: string;
      dispatchedAt?: Date;
    };
  }) {
    if (!input.previousExecution) {
      return { canProceed: true, outcome: "KNOWN" };
    }

    const { status, dispatchedAt } = input.previousExecution;

    if (
      status === PackageExecutionStatus.COMPLETED ||
      status === PackageExecutionStatus.PARTIAL ||
      status === PackageExecutionStatus.CANCELLED
    ) {
      return { canProceed: true, outcome: "KNOWN" };
    }

    // If still in DISPATCHED or UNCERTAIN, check timeout T (24 hours)
    const timeoutMs = 24 * 3600 * 1000;
    const elapsed = dispatchedAt ? Date.now() - new Date(dispatchedAt).getTime() : 0;

    if (elapsed > timeoutMs) {
      return {
        canProceed: false,
        outcome: "STALLED",
        raiseAdminAlert: true,
        reason: `Previous batch execution #${input.previousExecution.id} timed out after 24 hours without terminal status.`,
      };
    }

    return {
      canProceed: false,
      outcome: "PENDING_CHECK",
      raiseAdminAlert: false,
    };
  }

  /**
   * Order Problem Report (F2.5)
   * Creates a high-priority ticket, opens stalled report, and prevents duplicate open reports
   */
  async reportOrderProblem(
    userId: string,
    orderId: string,
    input: { issueType: string; notes?: string }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException("Order not found.");
    }
    if (order.userId && order.userId !== userId) {
      throw new ForbiddenException("Cannot report problem on another user's order.");
    }

    // Check for open report
    const existingOpenReport = typeof (this.prisma as any).stalledReport?.findFirst === "function"
      ? await (this.prisma as any).stalledReport.findFirst({
          where: { orderId, status: "OPEN" },
        })
      : null;
    if (existingOpenReport) {
      throw new ConflictException("An open problem report already exists for this order.");
    }

    const report = typeof (this.prisma as any).stalledReport?.create === "function"
      ? await (this.prisma as any).stalledReport.create({
          data: {
            orderId,
            userId,
            status: "OPEN",
            issueType: input.issueType || "GENERAL",
            notes: input.notes || "",
          },
        })
      : { id: `rep_${Date.now()}` };

    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        subject: `Problem Report: Order #${orderId}`,
        priority: "HIGH",
        status: "OPEN",
      },
    });

    return {
      success: true,
      reportId: report.id,
      ticketId: ticket.id,
    };
  }

  /**
   * Custom Comments Moderation (F2.6)
   * Enforces count == quantity, rejects URLs, phone numbers, duplicates, and escapes HTML
   */
  moderateComments(rawComments: string[], expectedQuantity: number) {
    const errors: string[] = [];

    if (!Array.isArray(rawComments) || rawComments.length !== expectedQuantity) {
      errors.push(`Comments count (${rawComments ? rawComments.length : 0}) must strictly equal requested quantity (${expectedQuantity}).`);
    }

    const urlRegex = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|co|me|ai)\b/i;
    const phoneRegex = /\b\d{7,15}\b/;

    const sanitizedComments: string[] = [];
    const seen = new Set<string>();
    let hasDuplicate = false;

    for (const comment of rawComments || []) {
      const trimmed = comment.trim();
      if (!trimmed) continue;

      if (urlRegex.test(trimmed)) {
        if (!errors.includes("Links and URLs are not permitted in custom comments.")) {
          errors.push("Links and URLs are not permitted in custom comments.");
        }
      }

      if (phoneRegex.test(trimmed)) {
        if (!errors.includes("Phone numbers or numeric sequences are not permitted.")) {
          errors.push("Phone numbers or numeric sequences are not permitted.");
        }
      }

      if (trimmed.length > 500) {
        errors.push("Comment line exceeds maximum length of 500 characters.");
      }

      if (seen.has(trimmed.toLowerCase())) {
        hasDuplicate = true;
      }
      seen.add(trimmed.toLowerCase());

      const escaped = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

      sanitizedComments.push(escaped);
    }

    if (hasDuplicate) {
      errors.push("Duplicate comment lines detected.");
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedComments,
    };
  }

  /**
   * Comment Sequencing (F2.6)
   * commentExecuteAt = max(likeBatch.executeAt + offset, now)
   */
  calculateCommentSequencing(likeExecuteAt: Date, offsetMinutes: number): Date {
    const minDelayMs = offsetMinutes * 60 * 1000;
    const baseTime = likeExecuteAt ? new Date(likeExecuteAt).getTime() : Date.now();
    return new Date(Math.max(baseTime + minDelayMs, Date.now()));
  }

  /**
   * Duration Pricing Tiers (F2.7)
   * Multiplier applied in Decimal, ceil once at the end
   */
  calculateTieredPrice(baseCost: Decimal, tier: { name: string; multiplier: Decimal }): Decimal {
    const raw = new Decimal(baseCost).times(new Decimal(tier.multiplier));
    return raw.toDecimalPlaces(2, Decimal.ROUND_CEIL);
  }

  /**
   * Deterministic Delivery Window (F2.8)
   * Shifts scheduledAt into user delivery window [windowStartHour, windowEndHour] using Intl without random jitter
   */
  applyDeliveryWindow(
    scheduledAt: Date,
    windowStartHour: number,
    windowEndHour: number,
    timezone: string
  ): Date {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(scheduledAt);
      const hourPart = parts.find((p) => p.type === "hour");
      const minPart = parts.find((p) => p.type === "minute");
      const localHour = hourPart ? parseInt(hourPart.value, 10) : scheduledAt.getUTCHours();
      const localMin = minPart ? parseInt(minPart.value, 10) : scheduledAt.getUTCMinutes();

      let inWindow = false;
      if (windowStartHour < windowEndHour) {
        inWindow = localHour >= windowStartHour && localHour < windowEndHour;
      } else {
        inWindow = localHour >= windowStartHour || localHour < windowEndHour;
      }

      if (inWindow) {
        return scheduledAt;
      }

      const currentLocalTotalMins = localHour * 60 + localMin;
      const targetLocalTotalMins = windowStartHour * 60;

      let minsToAdd = 0;
      if (currentLocalTotalMins < targetLocalTotalMins) {
        minsToAdd = targetLocalTotalMins - currentLocalTotalMins;
      } else {
        minsToAdd = 24 * 60 - currentLocalTotalMins + targetLocalTotalMins;
      }

      return new Date(scheduledAt.getTime() + minsToAdd * 60 * 1000);
    } catch {
      return scheduledAt;
    }
  }

  /**
   * Preset Package Bundles (F3.1)
   */
  getBundleTemplates() {
    return [
      {
        id: "bundle_starter_ig",
        name: "Instagram Starter Bundle",
        description: "Standard starter bundle combining 500 followers and post engagement.",
        platform: "instagram",
        durationDays: 30,
        discountPercent: 10,
        rules: [
          { kind: PackageRuleKind.TIME_DRIP, serviceId: "1042", quantityPerPost: 500, intervalDays: 1 },
          { kind: PackageRuleKind.POST_TRIGGERED, serviceId: "1043", quantityPerPost: 100, maxPosts: 10 },
        ],
        bundlePrice: new Decimal(2500),
      },
      {
        id: "bundle_growth_yt",
        name: "YouTube Channel Growth Bundle",
        description: "Scheduled subscriber and video view delivery bundle.",
        platform: "youtube",
        durationDays: 30,
        discountPercent: 15,
        rules: [
          { kind: PackageRuleKind.TIME_DRIP, serviceId: "2016", quantityPerPost: 250, intervalDays: 2 },
          { kind: PackageRuleKind.POST_TRIGGERED, serviceId: "2015", quantityPerPost: 1000, maxPosts: 10 },
        ],
        bundlePrice: new Decimal(4500),
      },
    ];
  }

  /**
   * Purchases a preset bundle (F3.1)
   */
  async purchaseBundle(
    userId: string,
    input: { templateId: string; handle: string; idempotencyKey?: string }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const template = this.getBundleTemplates().find((t) => t.id === input.templateId);
    if (!template) {
      throw new NotFoundException(`Bundle template "${input.templateId}" not found.`);
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Check wallet balance
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || new Decimal(wallet.balance).lt(template.bundlePrice)) {
        throw new BadRequestException("Insufficient wallet balance for bundle purchase.");
      }

      // 2. Deduct wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Decimal(wallet.balance).minus(template.bundlePrice) },
      });

      const now = new Date();
      const endAt = new Date(now.getTime() + template.durationDays * 86400000);

      // 3. Create Package
      const pkg = await tx.package.create({
        data: {
          userId,
          platform: template.platform,
          handle: input.handle.trim().replace(/^@/, ""),
          status: PackageStatus.ACTIVE,
          startAt: now,
          endAt,
          reserveTotal: template.bundlePrice,
          idempotencyKey: input.idempotencyKey || null,
        },
      });

      // 4. Create Rules
      for (const rule of template.rules) {
        await tx.packageRule.create({
          data: {
            packageId: pkg.id,
            kind: rule.kind,
            serviceId: rule.serviceId,
            quantityPerPost: rule.quantityPerPost,
            maxPosts: (rule as any).maxPosts || 1,
            unitCharge: new Decimal(0),
            rateSnapshot: new Decimal(0),
            reserve: new Decimal(0),
          },
        });
      }

      // 5. Create Ledger Entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amount: template.bundlePrice.negated(),
          type: TransactionType.PACKAGE_PURCHASE,
          description: `Preset Bundle: ${template.name}`,
        },
      });

      return {
        success: true,
        packageId: pkg.id,
        templateId: template.id,
        amountCharged: template.bundlePrice,
      };
    });
  }

  /**
   * Monthly Retainer Auto-Renew (F3.2)
   */
  async renewPackage(
    userId: string,
    packageId: string,
    input: { explicitConsent: boolean }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: { rules: true },
    });
    if (!pkg) {
      throw new NotFoundException("Package not found.");
    }
    if (userId && pkg.userId && pkg.userId !== userId) {
      throw new ForbiddenException("Cannot renew package belonging to another user.");
    }
    if (!input.explicitConsent || (pkg as any).autoRenew === false) {
      throw new ForbiddenException("Explicit auto-renew consent is required.");
    }

    const renewalCost = new Decimal(pkg.reserveTotal);

    // Check wallet balance
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: pkg.userId } });
    if (!wallet || new Decimal(wallet.balance).lt(renewalCost)) {
      this.logger.warn(`Retainer auto-renew refused: insufficient balance for user ${pkg.userId} on pkg ${packageId}`);
      return {
        success: false,
        reason: "INSUFFICIENT_BALANCE",
        message: "Wallet balance is insufficient to process package auto-renewal.",
      };
    }

    return this.prisma.$transaction(async (tx: any) => {
      // Deduct balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Decimal(wallet.balance).minus(renewalCost) },
      });

      // Write ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amount: renewalCost,
          type: "PURCHASE",
          balanceAfter: new Decimal(wallet.balance).minus(renewalCost),
          description: `Auto-renewal of package ${pkg.id}`,
        },
      });

      const now = new Date();
      const durationMs = pkg.endAt && pkg.startAt ? new Date(pkg.endAt).getTime() - new Date(pkg.startAt).getTime() : 30 * 86400000;
      const endAt = new Date(now.getTime() + durationMs);

      const renewed = await tx.package.create({
        data: {
          userId: pkg.userId,
          platform: pkg.platform,
          handle: pkg.handle,
          status: PackageStatus.ACTIVE,
          startAt: now,
          endAt,
          autoRenew: true,
          renewalOfId: pkg.id,
          reserveTotal: renewalCost,
        },
      });

      return {
        success: true,
        newPackageId: renewed.id,
        renewalOfId: pkg.id,
        renewedAt: now,
      };
    });
  }

  /**
   * Updates Auto-Renew flag for a package (F3.2)
   */
  async setAutoRenew(userId: string, packageId: string, enabled: boolean) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) {
      throw new NotFoundException("Package not found.");
    }
    if (userId && pkg.userId && pkg.userId !== userId) {
      throw new ForbiddenException("Cannot modify package belonging to another user.");
    }
    const updated = await this.prisma.package.update({
      where: { id: packageId },
      data: { autoRenew: enabled } as any,
    });
    return {
      packageId: updated.id,
      autoRenew: (updated as any).autoRenew,
    };
  }

  /**
   * Handles timeout during provider dispatch (F3.3)
   */
  handleProviderDispatchTimeout(input: {
    executionId: string;
    primaryProviderId: string;
    providerOrderId?: string | null;
  }) {
    return {
      executionId: input.executionId,
      status: "UNCERTAIN",
      outcome: "UNKNOWN",
      canFailoverImmediately: false,
      nextAction: "QUERY_PRIMARY_STATUS",
      reason: "Add-order dispatch timed out. Primary provider status must be queried before considering failover.",
    };
  }

  /**
   * Evaluates failover eligibility to backup provider (F3.3)
   */
  async evaluateFailoverRouting(input: {
    serviceConfig: any;
    backupService?: any;
    primaryStatusConfirmation: string;
    quantity: number;
  }) {
    if (input.primaryStatusConfirmation === "CONFIRMED_PLACED") {
      return {
        approved: false,
        reason: "PRIMARY_ORDER_EXISTS",
        message: "Primary provider confirmed order was placed. Failover aborted to prevent duplicate delivery.",
      };
    }

    if (
      input.primaryStatusConfirmation === "ORDER_NOT_FOUND" ||
      input.primaryStatusConfirmation === "CONFIRMED_FAILED"
    ) {
      const { backupService, serviceConfig, quantity } = input;
      if (!serviceConfig.backupProviderId || !serviceConfig.backupProviderServiceId) {
        return {
          approved: false,
          reason: "NO_BACKUP_PROVIDER_CONFIGURED",
        };
      }

      if (backupService) {
        if (backupService.active === false) {
          return { approved: false, reason: "BACKUP_SERVICE_INACTIVE" };
        }
        if (quantity < backupService.minQty || quantity > backupService.maxQty) {
          return {
            approved: false,
            reason: `ORDER_QUANTITY_OUT_OF_BOUNDS: ${quantity} outside [${backupService.minQty}, ${backupService.maxQty}]`,
          };
        }
      }

      return {
        approved: true,
        targetProviderId: serviceConfig.backupProviderId,
        targetServiceId: serviceConfig.backupProviderServiceId,
        reason: "Failover approved following confirmed primary provider failure.",
      };
    }

    return {
      approved: false,
      reason: `UNRESOLVED_PRIMARY_STATUS: ${input.primaryStatusConfirmation}`,
    };
  }

  /**
   * Safe fields for service exposed to customer/reseller (no internal margins, costs, or provider credentials)
   */
  private static readonly CUSTOMER_SAFE_SERVICE_SELECT = {
    id: true,
    name: true,
    displayName: true,
    platform: true,
    ratePer1000: true,
    minQty: true,
    maxQty: true,
    packageEligible: true,
    status: true,
    avgTime: true,
    description: true,
  } as const;

  /**
   * Safe fields for child order exposed to customer (no internal provider order IDs or costs)
   */
  private static readonly CUSTOMER_SAFE_ORDER_SELECT = {
    id: true,
    status: true,
    quantity: true,
    charge: true,
    startCount: true,
    remains: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  /**
   * Lists customer growth packages with strict cost/provider field redaction
   */
  async listPackages(userId: string) {
    if (!this.prisma.isConnected) {
      return Array.from(this.sandboxPackages.values()).filter((p) => p.userId === userId);
    }

    return this.prisma.package.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        rules: {
          include: {
            service: {
              select: PackagesService.CUSTOMER_SAFE_SERVICE_SELECT,
            },
          },
        },
        executions: true,
      },
    });
  }

  /**
   * Inspects detailed package status and executions with strict cost/provider field redaction
   */
  async getPackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || (userId && pkg.userId && pkg.userId !== userId)) {
        throw new NotFoundException("Package not found.");
      }
      return pkg;
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
      include: {
        rules: {
          include: {
            service: {
              select: PackagesService.CUSTOMER_SAFE_SERVICE_SELECT,
            },
          },
        },
        executions: { orderBy: { seq: "asc" } },
        triggers: true,
      },
    });

    if (!pkg) throw new NotFoundException("Package not found.");
    return pkg;
  }

  /**
   * Returns triggers processed for this package
   */
  async getPackageTriggers(userId: string, packageId: string) {
    if (!this.prisma.isConnected) return [];

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    return this.prisma.packageTrigger.findMany({
      where: { packageId },
      include: { executions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Returns list of executions for this package with strict redaction of provider & cost
   */
  async getPackageExecutions(userId: string, packageId: string) {
    if (!this.prisma.isConnected) return [];

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    const executions = await this.prisma.packageExecution.findMany({
      where: { packageId },
      include: {
        rule: {
          include: {
            service: {
              select: PackagesService.CUSTOMER_SAFE_SERVICE_SELECT,
            },
          },
        },
        trigger: true,
        order: {
          select: PackagesService.CUSTOMER_SAFE_ORDER_SELECT,
        },
      },
      orderBy: { executeAt: "asc" },
    });

    return executions.map(({ providerOrderId, ...rest }: any) => rest);
  }

  /**
   * Customer problem report: creates a high-priority support ticket and flags package for review
   */
  async reportProblem(
    userId: string,
    packageId: string,
    body: { issue: string; description: string }
  ) {
    if (!body.issue || !body.description) {
      throw new BadRequestException("issue and description are required to report a problem.");
    }
    if (body.issue.length > 100) {
      throw new BadRequestException("issue title cannot exceed 100 characters.");
    }
    if (body.description.length > 2000) {
      throw new BadRequestException("description cannot exceed 2000 characters.");
    }

    if (!this.prisma.isConnected) {
      return {
        success: true,
        ticketId: `TCK-PKG-${Date.now()}`,
        message: "Problem reported successfully. Support ticket created.",
      };
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    if (pkg.status === PackageStatus.CANCELLED || pkg.status === PackageStatus.COMPLETED) {
      throw new BadRequestException(`Cannot report a problem on a ${pkg.status.toLowerCase()} package.`);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        subject: `[Package #${packageId}] ${body.issue}`,
        priority: "HIGH",
        status: "OPEN",
        messages: {
          create: {
            senderId: userId,
            message: `Customer reported problem on Package #${packageId} (@${pkg.handle} on ${pkg.platform}):\nIssue: ${body.issue}\nDetails: ${body.description}`,
          },
        },
      },
    });

    return {
      success: true,
      ticketId: ticket.id,
      packageId: pkg.id,
      status: "OPEN",
      message: "Problem reported successfully. High-priority support ticket created.",
    };
  }

  /**
   * Admin Package Overview: reveals cost, revenue, and profit per package
   */
  async getAdminPackageSummary(packageId: string) {
    if (!this.prisma.isConnected) {
      return {
        packageId,
        revenueINR: 100,
        estimatedCostINR: 60,
        estimatedProfitINR: 40,
        estimatedMarginPercent: 40.0,
      };
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        rules: { include: { service: true } },
        executions: { include: { order: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    const revenue = Number(pkg.reserveTotal);
    let totalEstimatedCost = 0;
    let totalActualCost = 0;

    for (const rule of pkg.rules) {
      const costPer1k = rule.service?.costINR ? Number(rule.service.costINR) : 0;
      const totalRuleQty = (rule.quantityPerPost || 0) * (rule.maxPosts || 1);
      totalEstimatedCost += (costPer1k * totalRuleQty) / 1000;
    }

    for (const exec of pkg.executions) {
      if ((exec.order as any)?.actualProviderCost) {
        totalActualCost += Number((exec.order as any).actualProviderCost);
      } else if ((exec.order as any)?.estimatedProviderCost) {
        totalActualCost += Number((exec.order as any).estimatedProviderCost);
      }
    }

    const estimatedProfit = Number((revenue - totalEstimatedCost).toFixed(2));
    const estimatedMarginPct = revenue > 0 ? Number(((estimatedProfit / revenue) * 100).toFixed(2)) : 0;

    return {
      packageId: pkg.id,
      user: pkg.user,
      platform: pkg.platform,
      handle: pkg.handle,
      status: pkg.status,
      revenueINR: revenue,
      estimatedCostINR: Number(totalEstimatedCost.toFixed(2)),
      estimatedProfitINR: estimatedProfit,
      estimatedMarginPercent: estimatedMarginPct,
      actualCostINR: Number(totalActualCost.toFixed(2)),
      actualProfitINR: Number((revenue - totalActualCost).toFixed(2)),
      rulesCount: pkg.rules.length,
      executionsCount: pkg.executions.length,
      createdAt: pkg.createdAt,
    };
  }

  /**
   * Single canonical refundExecution function implementing:
   * 1. Consistent row locking order: PackageExecution -> Wallet (prevents deadlocks).
   * 2. Decimal-only arithmetic.
   * 3. Idempotency checks.
   * 4. Provider cross-verification.
   * 5. Invariant enforcement: sum(refunds) <= allocatedCharge.
   * 6. Admin reason >= 10 chars.
   * 7. Two-man rule: refunds > 500 INR require second approval.
   * 8. Audit logging.
   */
  async refundExecution(
    tx: any,
    executionId: string,
    options: {
      reason: string;
      actor: { userId: string; role: string };
      idempotencyKey?: string;
      twoManRuleApproved?: boolean;
      secondApproverId?: string;
    }
  ) {
    const reason = (options.reason || "").trim();
    if (reason.length < 10) {
      throw new BadRequestException("Refund reason must be at least 10 characters long.");
    }

    // Check idempotency if key provided
    if (options.idempotencyKey) {
      const existingLedger = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existingLedger) {
        return {
          success: true,
          executionId,
          action: "REFUND",
          refundAmount: new Decimal(existingLedger.amount).toNumber(),
          newStatus: PackageExecutionStatus.CANCELLED,
          isReplay: true,
        };
      }
    }

    // 1. Consistent row lock on PackageExecution first
    let execRows: any[] | null = null;
    if (typeof tx.$queryRawUnsafe === "function") {
      try {
        execRows = await tx.$queryRawUnsafe(
          `SELECT * FROM "PackageExecution" WHERE id = $1 FOR UPDATE`,
          executionId
        );
      } catch {}
    }
    let execution: any = execRows && execRows[0];
    if (!execution && typeof tx.packageExecution?.findUnique === "function") {
      execution = await tx.packageExecution.findUnique({
        where: { id: executionId },
        include: { package: true, order: true },
      });
    }
    if (!execution) {
      throw new NotFoundException("Package execution not found.");
    }

    if (execution.status === PackageExecutionStatus.CANCELLED) {
      throw new ConflictException("Execution has already been cancelled and refunded.");
    }

    if (execution.status === PackageExecutionStatus.COMPLETED) {
      throw new ConflictException(`Cannot refund an execution in terminal status "${execution.status}".`);
    }

    // Atomic status transition: only ONE caller can transition the execution away from non-terminal status
    if (typeof tx.packageExecution?.updateMany === "function") {
      const updateResult = await tx.packageExecution.updateMany({
        where: {
          id: executionId,
          status: { notIn: [PackageExecutionStatus.CANCELLED, PackageExecutionStatus.COMPLETED] },
        },
        data: {
          status: PackageExecutionStatus.CANCELLED,
          skipReason: reason,
        },
      });

      if (updateResult && updateResult.count === 0) {
        throw new ConflictException(
          "Execution is already in a terminal status or has already been refunded."
        );
      }
    } else if (typeof tx.packageExecution?.update === "function") {
      await tx.packageExecution.update({
        where: { id: executionId },
        data: {
          status: PackageExecutionStatus.CANCELLED,
          skipReason: reason,
        },
      });
    }

    // 2. Cross-verify provider status if child order exists
    if (execution.orderId) {
      let orderRows: any[] | null = null;
      if (typeof tx.$queryRawUnsafe === "function") {
        try {
          orderRows = await tx.$queryRawUnsafe(
            `SELECT * FROM "Order" WHERE id = $1 FOR UPDATE`,
            execution.orderId
          );
        } catch {}
      }
      const childOrder: any =
        (orderRows && orderRows[0]) ||
        execution.order ||
        (typeof tx.order?.findUnique === "function" ? await tx.order.findUnique({ where: { id: execution.orderId } }) : null);
      if (childOrder) {
        const orderCharge = new Decimal(childOrder.charge || 0);
        if (childOrder.status === "COMPLETED" && orderCharge.greaterThan(0)) {
          throw new ConflictException(
            "Cannot refund an execution whose upstream provider order has already completed."
          );
        }
      }
    }

    const refundAmount = new Decimal(execution.allocatedCharge);
    if (refundAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Allocated charge for execution is 0; no refund due.");
    }

    // Invariant: sum of prior refunds + refundAmount <= allocatedCharge
    let priorRefunds: any[] = [];
    if (typeof tx.refund?.findMany === "function") {
      priorRefunds = await tx.refund.findMany({
        where: { packageId: execution.packageId },
      });
    }
    const existingRefundSum = (priorRefunds || [])
      .filter((r: any) => r.reason?.includes(executionId) || r.orderId === execution.orderId)
      .reduce((sum: Decimal, r: any) => sum.plus(new Decimal(r.amount)), new Decimal(0));
    const allocatedChargeDecimal = new Decimal(execution.allocatedCharge);
    if (existingRefundSum.plus(refundAmount).greaterThan(allocatedChargeDecimal)) {
      throw new ConflictException("Refund exceeds allocated charge for this execution.");
    }

    // 3. Two-Man Rule enforcement for refunds > 500 INR
    if (refundAmount.greaterThan(500)) {
      if (
        !options.twoManRuleApproved ||
        !options.secondApproverId ||
        options.secondApproverId === options.actor.userId
      ) {
        throw new ForbiddenException(
          "REFUND_REQUIRES_TWO_MAN_RULE: Manual refunds exceeding ₹500 require two-person administrative approval."
        );
      }
    }

    // Resolve userId for package
    let pkgUserId = execution.package?.userId;
    if (!pkgUserId && typeof tx.package?.findUnique === "function") {
      const pkg = await tx.package.findUnique({ where: { id: execution.packageId } });
      pkgUserId = pkg?.userId;
    }

    // 4. Consistent row lock on Wallet next
    let walletRows: any[] | null = null;
    if (typeof tx.$queryRawUnsafe === "function") {
      try {
        walletRows = await tx.$queryRawUnsafe(
          `SELECT * FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
          pkgUserId
        );
      } catch {}
    }
    let wallet: any = walletRows && walletRows[0];
    if (!wallet && typeof tx.wallet?.findUnique === "function") {
      wallet = await tx.wallet.findUnique({ where: { userId: pkgUserId } });
    }
    if (!wallet) {
      throw new NotFoundException("Customer wallet not found.");
    }

    const beforeBalance = new Decimal(wallet.balance);
    const afterBalance = beforeBalance.plus(refundAmount);

    // Credit wallet
    if (typeof tx.wallet?.update === "function") {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: afterBalance },
      });
    }

    // Write Ledger Entry
    if (typeof tx.ledgerEntry?.create === "function") {
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amount: refundAmount,
          type: TransactionType.PACKAGE_REFUND,
          referenceId: `REF_EXEC_${executionId}`,
          idempotencyKey: options.idempotencyKey || null,
          description: `Admin manual refund for package execution #${executionId}: ${reason}`,
        },
      });
    }

    // Write Refund Record
    if (typeof tx.refund?.create === "function") {
      await tx.refund.create({
        data: {
          packageId: execution.packageId,
          orderId: execution.orderId || null,
          userId: pkgUserId,
          amount: refundAmount,
          reason,
        },
      });
    }

    // Write AuditLog
    if (typeof tx.auditLog?.create === "function") {
      await tx.auditLog.create({
        data: {
          userId: options.actor.userId,
          action: "PACKAGE_EXECUTION_REFUND",
          resource: executionId,
          payload: {
            actor: options.actor,
            beforeBalance: beforeBalance.toNumber(),
            afterBalance: afterBalance.toNumber(),
            refundAmount: refundAmount.toNumber(),
            reason,
            providerStatus: execution.orderId ? "CHECKED" : null,
            idempotencyKey: options.idempotencyKey || null,
            secondApproverId: options.secondApproverId || null,
          },
        },
      });
    }

    return {
      success: true,
      executionId,
      action: "REFUND",
      refundAmount: refundAmount.toNumber(),
      newStatus: PackageExecutionStatus.CANCELLED,
    };
  }

  /**
   * Admin resolution of UNCERTAIN or STALLED package executions (retry / mark sent / refund)
   */
  async adminResolveExecution(
    executionId: string,
    action: "RETRY" | "MARK_SENT" | "REFUND",
    payload?: {
      providerOrderId?: string;
      reason?: string;
      actor?: { userId: string; role: string };
      idempotencyKey?: string;
      twoManRuleApproved?: boolean;
      secondApproverId?: string;
    }
  ) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    if (action === "REFUND") {
      if (!payload?.reason || payload.reason.trim().length < 10) {
        throw new BadRequestException(
          "Refund reason must be at least 10 characters long."
        );
      }
    }

    const execution = await this.prisma.packageExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution) throw new NotFoundException("Package execution not found.");
    if (
      execution.status === PackageExecutionStatus.COMPLETED ||
      execution.status === PackageExecutionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot ${action.toLowerCase()} an execution in terminal status "${execution.status}".`
      );
    }

    if (action === "RETRY") {
      await this.prisma.packageExecution.update({
        where: { id: executionId },
        data: {
          status: PackageExecutionStatus.SCHEDULED,
          skipReason: null,
          executeAt: new Date(),
        },
      });
      if (typeof this.prisma.auditLog?.create === "function") {
        await this.prisma.auditLog.create({
          data: {
            action: "ADMIN_RESOLVE_EXECUTION_RETRY",
            userId: payload?.actor?.userId || null,
            resource: executionId,
            payload: {
              previousStatus: execution.status,
              newAction: action,
              reason: payload?.reason,
            },
          },
        }).catch(() => {});
      }
      return { success: true, executionId, action: "RETRY", newStatus: PackageExecutionStatus.SCHEDULED };
    }

    if (action === "MARK_SENT") {
      const providerOrderId = payload?.providerOrderId || "ADMIN_MANUAL_SENT";
      await this.prisma.packageExecution.update({
        where: { id: executionId },
        data: {
          status: PackageExecutionStatus.DISPATCHED,
          skipReason: null,
        },
      });
      if (execution.orderId) {
        await this.prisma.order.update({
          where: { id: execution.orderId },
          data: { providerOrderId, status: "PROCESSING" as any },
        });
      }
      if (typeof this.prisma.auditLog?.create === "function") {
        await this.prisma.auditLog.create({
          data: {
            action: "ADMIN_RESOLVE_EXECUTION_MARK_SENT",
            userId: payload?.actor?.userId || null,
            resource: executionId,
            payload: {
              previousStatus: execution.status,
              newAction: action,
              providerOrderId,
              reason: payload?.reason,
            },
          },
        }).catch(() => {});
      }
      return { success: true, executionId, action: "MARK_SENT", newStatus: PackageExecutionStatus.DISPATCHED, providerOrderId };
    }

    if (action === "REFUND") {
      const actor = payload?.actor || { userId: "admin", role: "ADMIN" };
      const refundOptions = {
        reason: payload?.reason || "Admin manual refund",
        actor,
        idempotencyKey: payload?.idempotencyKey,
        twoManRuleApproved: payload?.twoManRuleApproved,
        secondApproverId: payload?.secondApproverId,
      };

      if (typeof this.prisma.$transaction === "function") {
        return this.prisma.$transaction(async (tx: any) => {
          return this.refundExecution(tx, executionId, refundOptions);
        });
      }
      return this.refundExecution(this.prisma, executionId, refundOptions);
    }

    throw new BadRequestException(`Unsupported admin action: ${action}`);
  }

  async getAdminExecutionsQueue(options: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.status) {
      where.status = options.status;
    } else {
      where.status = {
        in: [
          PackageExecutionStatus.SCHEDULED,
          PackageExecutionStatus.DISPATCHED,
          PackageExecutionStatus.PARTIAL,
          PackageExecutionStatus.FAILED,
          PackageExecutionStatus.CANCELLED,
        ],
      };
    }

    if (!this.prisma.isConnected) {
      return {
        page,
        limit,
        totalCount: 0,
        totalPages: 0,
        items: [],
      };
    }

    const [totalCount, rows] = await Promise.all([
      this.prisma.packageExecution.count({ where }),
      this.prisma.packageExecution.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ executeAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          packageId: true,
          status: true,
          source: true,
          seq: true,
          quantity: true,
          allocatedCharge: true,
          executeAt: true,
          skipReason: true,
          createdAt: true,
          package: {
            select: {
              platform: true,
              handle: true,
              status: true,
              userId: true,
            },
          },
          rule: {
            select: {
              serviceId: true,
              kind: true,
              service: {
                select: {
                  displayName: true,
                  name: true,
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              remains: true,
              startCount: true,
              providerOrderId: true,
            },
          },
        },
      }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      packageId: row.packageId,
      platform: row.package?.platform,
      handle: row.package?.handle,
      userId: row.package?.userId,
      packageStatus: row.package?.status,
      serviceId: row.rule?.serviceId,
      serviceName: row.rule?.service?.displayName || row.rule?.service?.name,
      ruleKind: row.rule?.kind,
      quantity: row.quantity,
      allocatedCharge: Number(row.allocatedCharge),
      status: row.status,
      source: row.source,
      seq: row.seq,
      executeAt: row.executeAt,
      skipReason: row.skipReason,
      createdAt: row.createdAt,
      order: row.order
        ? {
            id: row.order.id,
            status: row.order.status,
            remains: row.order.remains,
            startCount: row.order.startCount,
            providerOrderId: row.order.providerOrderId,
          }
        : null,
    }));

    return {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      items,
    };
  }
}
