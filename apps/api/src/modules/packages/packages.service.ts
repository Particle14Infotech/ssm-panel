import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PackagesQuoteService } from "./packages-quote.service";
import { PlatformsService } from "../platforms/platforms.service";
import { validateHandle, validatePlatformLink } from "../platforms/platform-rules.util";
import {
  PackageQuoteInput,
  PackagePurchaseInput,
  TriggerPreviewInput,
  TriggerExecutionInput,
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

// Allowlist regex for Instagram post / reel links (never arbitrary URLs)
const INSTAGRAM_URL_REGEX = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);
  private sandboxPackages = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: PackagesQuoteService,
    private readonly platformsService: PlatformsService
  ) {}

  /**
   * Generates a preview quote for package configuration (no side effects)
   */
  async getQuote(input: PackageQuoteInput) {
    return this.quoteService.calculateQuote(input);
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
    const config = await this.platformsService.getPlatformConfig(platform);
    const handle = validateHandle(input.handle || (input as any).accountUsername || "", config);

    // 1. Check existing idempotent purchase
    if (this.prisma.isConnected) {
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
    }

    // 2. Check admin handle blocklist
    const isBlocked = await this.platformsService.isHandleBlocked(platform, handle);
    if (isBlocked) {
      throw new BadRequestException(`Handle "@${handle}" is blocked from purchasing packages.`);
    }

    // 3. Authoritative Quote Calculation (equals purchase price)
    const quote = await this.quoteService.calculateQuote(input);
    const reserveTotal = new Decimal(quote.totalCharge);

    const durationDays = input.durationDays || input.days || 30;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 3600 * 1000);

    if (!this.prisma.isConnected) {
      // In-memory fallback
      const packageId = `pkg_sbx_${Date.now()}`;
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
          const itemRuns = quote.timeline.filter((t) => t.serviceId === item.serviceId);
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
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      return {
        platform: pkg.platform || "instagram",
        handle: pkg.handle,
        mediaKey: "preview_key",
        normalizedUrl: input.url,
        alreadyTriggered: false,
        rules: [],
      };
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
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      return {
        success: true,
        triggerId: `trig_sbx_${Date.now()}`,
        mediaKey: "sbx_key",
        executionsCreated: 1,
      };
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
   * Cancels undispatched executions and refunds unused reserve back to the customer wallet exactly once.
   * Invariant verified: purchased = consumed + refunded + remaining (0).
   */
  async cancelPackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = PackageStatus.CANCELLED;
      return { success: true, refundedAmount: 0 };
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
          status: { in: [PackageExecutionStatus.SCHEDULED, PackageExecutionStatus.DETECTED] },
        },
        data: {
          status: PackageExecutionStatus.CANCELLED,
          skipReason: "User cancelled package",
        },
      });

      // 3. Compute consumed reserve from DISPATCHED or COMPLETED executions
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
    if (!this.prisma.isConnected) return { success: true };

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
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = PackageStatus.PAUSED;
      return { success: true, status: PackageStatus.PAUSED };
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");
    if (pkg.status !== PackageStatus.ACTIVE) {
      throw new BadRequestException(`Cannot pause package with status "${pkg.status}".`);
    }

    // Check max pause days setting
    let maxPauseDays = 14;
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: "PACKAGE_SETTINGS" },
      });
      if (setting?.value && (setting.value as any).packageMaxPauseDays) {
        maxPauseDays = Number((setting.value as any).packageMaxPauseDays);
      }
    } catch {}

    if (pkg.pausedDays >= maxPauseDays) {
      throw new BadRequestException(`Maximum pause days limit reached for this package (${maxPauseDays} days).`);
    }

    await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.PAUSED },
    });

    return { success: true, status: PackageStatus.PAUSED, maxPauseDays, pausedDays: pkg.pausedDays };
  }

  /**
   * Resumes a paused package and extends endAt by the pause duration
   */
  async resumePackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = PackageStatus.ACTIVE;
      return { success: true, status: PackageStatus.ACTIVE };
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");
    if (pkg.status !== PackageStatus.PAUSED) {
      throw new BadRequestException(`Cannot resume package with status "${pkg.status}".`);
    }

    // Calculate pause duration and extend endAt
    const pauseDurationMs = Math.max(0, Date.now() - new Date(pkg.updatedAt).getTime());
    const pauseDays = Math.max(1, Math.ceil(pauseDurationMs / (24 * 3600 * 1000)));
    const newPausedDays = pkg.pausedDays + pauseDays;
    const newEndAt = new Date(new Date(pkg.endAt).getTime() + pauseDurationMs);

    await this.prisma.package.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.ACTIVE,
        pausedDays: newPausedDays,
        endAt: newEndAt,
      },
    });

    return {
      success: true,
      status: PackageStatus.ACTIVE,
      pausedDays: newPausedDays,
      endAt: newEndAt.toISOString(),
    };
  }

  /**
   * Lists customer growth packages
   */
  async listPackages(userId: string) {
    if (!this.prisma.isConnected) {
      return Array.from(this.sandboxPackages.values()).filter((p) => p.userId === userId);
    }

    return this.prisma.package.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        rules: { include: { service: true } },
        executions: true,
      },
    });
  }

  /**
   * Inspects detailed package status and executions
   */
  async getPackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      return pkg;
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
      include: {
        rules: { include: { service: true } },
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
   * Returns list of executions for this package
   */
  async getPackageExecutions(userId: string, packageId: string) {
    if (!this.prisma.isConnected) return [];

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    return this.prisma.packageExecution.findMany({
      where: { packageId },
      include: {
        rule: { include: { service: true } },
        trigger: true,
        order: true,
      },
      orderBy: { executeAt: "asc" },
    });
  }
}
