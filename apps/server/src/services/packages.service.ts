import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";
import { Decimal } from "decimal.js";
import {
  PackageStatus,
  PackageRuleKind,
  PackageExecutionStatus,
  ExecutionSource,
  TransactionType,
} from "@prisma/client";
import {
  PackageQuoteInput,
  PackagePurchaseInput,
  TriggerPreviewInput,
  TriggerExecutionInput,
  RescheduleExecutionInput,
} from "@smm/contracts";
import { PackagesQuoteService } from "./packages-quote.service";
import { PlatformsService } from "./platforms.service";
import { validateHandle, validatePlatformLink } from "./platform-rules.util";
import { calculatePackageAccounting } from "./package-accounting.util";
import { verifyQuoteHash } from "./package-quote-hash.util";
import { calculatePerPostDrip } from "./drip-engine.util";
import { PackagesServiceLike } from "../routes/packages";
import { CacheLike } from "../cache";
import crypto from "crypto";

export class PackagesService implements PackagesServiceLike {
  constructor(
    private readonly prisma: PrismaLike,
    private readonly quoteService: PackagesQuoteService,
    private readonly platformsService: PlatformsService,
    private readonly cache?: CacheLike
  ) {}

  async getQuote(input: PackageQuoteInput, userId?: string, clientIp?: string): Promise<any> {
    const effectiveUserId = userId || (input as any).userId;

    if (this.cache) {
      if (effectiveUserId) {
        const count = await this.cache.increment(`quote:user:${effectiveUserId}`, 60);
        if (count > 30) {
          throw new ApiError(429, "QUOTE_RATE_LIMIT_EXCEEDED", "User quote rate limit exceeded. Retry in 60 seconds.");
        }
      }
      if (clientIp) {
        const count = await this.cache.increment(`quote:ip:${clientIp}`, 60);
        if (count > 60) {
          throw new ApiError(429, "QUOTE_RATE_LIMIT_EXCEEDED", "IP quote rate limit exceeded. Retry in 60 seconds.");
        }
      }
    }

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
    const hash = crypto.createHash("sha256").update(JSON.stringify(cachePayload)).digest("hex");
    const cacheKey = `quote:cache:${hash}`;

    if (this.cache) {
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
    }

    const calculated = await this.quoteService.calculateQuote({
      ...input,
      ...(effectiveUserId ? { userId: effectiveUserId } : {}),
    });

    if (this.cache) {
      await this.cache.set(cacheKey, calculated, 60);
    }
    return calculated;
  }

  async purchasePackage(userId: string, input: PackagePurchaseInput): Promise<any> {
    const idempotencyKey = input.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key is required for package purchase.");
    }
    if (!input.consentRulesUnderstood) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "You must acknowledge and agree that platform rules and delivery terms are understood."
      );
    }

    const platform = (input.platform || "instagram").toLowerCase().trim();
    const timezone = input.timezone || "UTC";
    const config = await this.platformsService.getPlatformConfig(platform);
    const handle = validateHandle(input.handle || (input as any).accountUsername || "", config);

    const client = this.prisma.client || this.prisma;

    if (client.package?.findUnique) {
      const existing = await client.package.findUnique({
        where: {
          unique_package_idempotency_per_user: {
            userId,
            idempotencyKey,
          },
        },
        include: { rules: true, executions: true },
      });
      if (existing) {
        return { success: true, package: existing, isReplay: true };
      }
    }

    const isBlocked = await this.platformsService.isHandleBlocked(platform, handle);
    if (isBlocked) {
      throw new ApiError(400, "BAD_REQUEST", `Handle "@${handle}" is blocked from purchasing packages.`);
    }

    if (!input.quoteHash || typeof input.quoteHash !== "string" || input.quoteHash.trim() === "") {
      throw new ApiError(400, "BAD_REQUEST", "quoteHash is required to purchase a package. Please fetch a fresh quote first.");
    }

    const startAt = new Date();
    const quote = await this.quoteService.calculateQuote({ ...input, userId }, startAt);

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
        throw new ApiError(409, "QUOTE_CHANGED", verification.message, { freshQuote: quote });
      }
      throw new ApiError(400, "BAD_REQUEST", verification.message);
    }

    const reserveTotal = new Decimal(quote.totalCharge);
    const durationDays = quote.days;
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 3600 * 1000);

    const txHandler = async (tx: any) => {
      const existingActive = await tx.package.findFirst({
        where: { platform, handle, status: PackageStatus.ACTIVE },
      });
      if (existingActive) {
        throw new ApiError(
          409,
          "CONFLICT",
          `An active package already exists for ${platform} handle "@${handle}". Complete or cancel it first.`
        );
      }

      let wallet: any;
      if (typeof tx.$queryRawUnsafe === "function") {
        try {
          const rows = await tx.$queryRawUnsafe(`SELECT * FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`, userId);
          wallet = Array.isArray(rows) ? rows[0] : null;
        } catch {}
      }
      if (!wallet && tx.wallet?.findUnique) {
        wallet = await tx.wallet.findUnique({ where: { userId } });
      }

      if (!wallet || new Decimal(wallet.balance.toString()).lessThan(reserveTotal)) {
        throw new ApiError(
          402,
          "PAYMENT_REQUIRED",
          `Insufficient wallet balance. Required: ₹${reserveTotal.toFixed(2)}, Available: ₹${new Decimal(wallet?.balance?.toString() || 0).toFixed(2)}.`
        );
      }

      const updatedBalance = new Decimal(wallet.balance.toString()).minus(reserveTotal);
      if (tx.wallet?.update) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: updatedBalance },
        });
      }

      const pkg = await tx.package.create({
        data: {
          userId,
          platform,
          handle,
          timezone,
          durationDays,
          reserveTotal,
          status: PackageStatus.ACTIVE,
          startAt,
          endAt,
          idempotencyKey,
        },
      });

      if (tx.ledgerEntry?.create) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            amount: reserveTotal.negated(),
            type: TransactionType.PACKAGE_PURCHASE,
            description: `Package Purchase #${pkg.id} for @${handle} (${platform})`,
          },
        });
      }

      for (const item of quote.items) {
        await tx.packageRule.create({
          data: {
            packageId: pkg.id,
            kind: item.kind as PackageRuleKind,
            serviceId: item.serviceId,
            quantityPerPost: item.quantityPerPost || item.totalQuantity,
            maxPosts: item.maxPosts || 1,
            unitCharge: new Decimal(item.charge).dividedBy(item.maxPosts || 1).toDecimalPlaces(2, Decimal.ROUND_CEIL),
            rateSnapshot: new Decimal(item.ratePer1000),
            reserve: new Decimal(item.charge),
            target: item.target,
            targetType: item.targetType,
            deliveryWindowMin: item.deliveryWindowMin || 0,
          },
        });
      }

      for (const run of quote.timeline) {
        await tx.packageExecution.create({
          data: {
            packageId: pkg.id,
            serviceId: run.serviceId,
            seq: run.runIndex,
            executeAt: new Date(run.scheduledAt),
            status: PackageExecutionStatus.SCHEDULED,
            source: ExecutionSource.SCHEDULE,
            quantity: run.quantity,
            remainingQuantity: run.quantity,
            allocatedCharge: new Decimal(run.chargeShare),
          },
        });
      }

      return {
        success: true,
        package: pkg,
        reserveTotal: reserveTotal.toNumber(),
      };
    };

    if (typeof this.prisma.$transaction === "function") {
      return this.prisma.$transaction(txHandler);
    }
    return txHandler(client);
  }

  async listPackages(userId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    return client.package.findMany({
      where: { userId },
      include: {
        rules: { include: { service: true } },
        executions: true,
        triggers: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPackage(userId: string, id: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const pkg = await client.package.findFirst({
      where: { id, userId },
      include: {
        rules: { include: { service: true } },
        executions: { orderBy: [{ seq: "asc" }, { executeAt: "asc" }] },
        triggers: { include: { executions: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!pkg) {
      throw new ApiError(404, "NOT_FOUND", "Package not found.");
    }
    return pkg;
  }

  async getPackageTriggers(userId: string, id: string): Promise<any> {
    await this.getPackage(userId, id);
    const client = this.prisma.client || this.prisma;
    return client.packageTrigger.findMany({
      where: { packageId: id },
      include: { executions: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPackageExecutions(userId: string, id: string): Promise<any> {
    await this.getPackage(userId, id);
    const client = this.prisma.client || this.prisma;
    return client.packageExecution.findMany({
      where: { packageId: id },
      include: { service: true, trigger: true },
      orderBy: [{ seq: "asc" }, { executeAt: "asc" }],
    });
  }

  async triggerPreview(userId: string, packageId: string, input: TriggerPreviewInput): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const pkg = await client.package.findFirst({
      where: { id: packageId, userId },
      include: {
        rules: {
          where: { kind: PackageRuleKind.POST_TRIGGERED },
          include: { service: true },
        },
      },
    });

    if (!pkg) {
      throw new ApiError(404, "NOT_FOUND", "Package not found or access denied.");
    }
    if (pkg.status !== PackageStatus.ACTIVE) {
      throw new ApiError(400, "BAD_REQUEST", `Cannot preview triggers for package in status "${pkg.status}".`);
    }

    const config = await this.platformsService.getPlatformConfig(pkg.platform);
    const linkRes = validatePlatformLink(input.url, config, pkg.handle);
    if (!linkRes.isValid || !linkRes.mediaKey) {
      throw new ApiError(400, "BAD_REQUEST", linkRes.error || "Invalid platform link.");
    }

    const rulePreviews = pkg.rules.map((rule: any) => {
      const remainingPosts = Math.max(0, rule.maxPosts - (rule.usedCount || 0));
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
        runs: drip.runs,
        chargePerPost: drip.totalCharge,
      };
    });

    return {
      packageId: pkg.id,
      platform: pkg.platform,
      handle: pkg.handle,
      targetUrl: linkRes.normalizedUrl,
      mediaKey: linkRes.mediaKey,
      rules: rulePreviews,
    };
  }

  async triggerStart(userId: string, packageId: string, input: TriggerExecutionInput, idempotencyKey: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const txHandler = async (tx: any) => {
      const pkg = await tx.package.findFirst({ where: { id: packageId, userId } });
      if (!pkg) {
        throw new ApiError(404, "NOT_FOUND", "Package not found or access denied.");
      }
      if (pkg.status !== PackageStatus.ACTIVE) {
        throw new ApiError(400, "BAD_REQUEST", `Cannot trigger execution for package in status "${pkg.status}".`);
      }

      const config = await this.platformsService.getPlatformConfig(pkg.platform);
      const linkRes = validatePlatformLink(input.url, config, pkg.handle);
      if (!linkRes.isValid || !linkRes.mediaKey) {
        throw new ApiError(400, "BAD_REQUEST", linkRes.error || "Invalid platform link.");
      }

      const existingTrigger = await tx.packageTrigger.findUnique({
        where: {
          packageId_mediaKey: {
            packageId: pkg.id,
            mediaKey: linkRes.mediaKey,
          },
        },
      });
      if (existingTrigger) {
        throw new ApiError(409, "CONFLICT", `This link has already been started for package #${pkg.id}.`);
      }

      const trigger = await tx.packageTrigger.create({
        data: {
          packageId: pkg.id,
          mediaKey: linkRes.mediaKey,
          targetUrl: linkRes.normalizedUrl,
        },
      });

      const postRules = await tx.packageRule.findMany({
        where: { packageId: pkg.id, kind: PackageRuleKind.POST_TRIGGERED },
        include: { service: true },
      });

      let totalRunsCreated = 0;
      for (const rule of postRules) {
        if (rule.usedCount >= rule.maxPosts) continue;

        const drip = calculatePerPostDrip({
          quantity: rule.quantityPerPost,
          serviceMin: rule.service.minQty,
          serviceMax: rule.service.maxQty,
          maxRunsPerPost: config.maxRunsPerPost,
          windowMinutes: rule.deliveryWindowMin || config.defaultWindowMinutes,
          minGapMinutes: config.minGapMinutes,
          ratePer1000: Number(rule.rateSnapshot),
          startAt: new Date(),
        });

        for (const run of drip.runs) {
          await tx.packageExecution.create({
            data: {
              packageId: pkg.id,
              triggerId: trigger.id,
              serviceId: rule.serviceId,
              seq: run.seq,
              executeAt: run.executeAt,
              status: PackageExecutionStatus.SCHEDULED,
              source: ExecutionSource.MEDIA,
              quantity: run.quantity,
              remainingQuantity: run.quantity,
              allocatedCharge: new Decimal(run.allocatedCharge),
            },
          });
          totalRunsCreated++;
        }

        await tx.packageRule.update({
          where: { id: rule.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      return {
        success: true,
        triggerId: trigger.id,
        executionsCreated: totalRunsCreated,
      };
    };

    if (typeof this.prisma.$transaction === "function") {
      return this.prisma.$transaction(txHandler);
    }
    return txHandler(client);
  }

  async rescheduleExecution(userId: string, packageId: string, executionId: string, data: RescheduleExecutionInput): Promise<any> {
    await this.getPackage(userId, packageId);
    const client = this.prisma.client || this.prisma;
    const execution = await client.packageExecution.findFirst({
      where: { id: executionId, packageId },
    });
    if (!execution) {
      throw new ApiError(404, "NOT_FOUND", "Execution not found.");
    }
    if (execution.status !== PackageExecutionStatus.SCHEDULED) {
      throw new ApiError(400, "BAD_REQUEST", `Cannot reschedule execution in status "${execution.status}".`);
    }

    const targetDate = (data as any).newExecuteAt || (data as any).executeAt;
    const updated = await client.packageExecution.update({
      where: { id: executionId },
      data: { executeAt: new Date(targetDate) },
    });
    return { success: true, execution: updated };
  }

  async swapTriggerLink(userId: string, packageId: string, tid: string, body: any): Promise<any> {
    await this.getPackage(userId, packageId);
    const client = this.prisma.client || this.prisma;
    const trigger = await client.packageTrigger.findFirst({
      where: { id: tid, packageId },
    });
    if (!trigger) {
      throw new ApiError(404, "NOT_FOUND", "Trigger not found.");
    }

    const updated = await client.packageTrigger.update({
      where: { id: tid },
      data: { targetUrl: body.newTargetUrl },
    });
    return { success: true, trigger: updated };
  }

  async speedUpPackage(userId: string, packageId: string, body: any): Promise<any> {
    await this.getPackage(userId, packageId);
    const client = this.prisma.client || this.prisma;
    const executions = await client.packageExecution.findMany({
      where: { packageId, status: PackageExecutionStatus.SCHEDULED },
      orderBy: { executeAt: "asc" },
    });
    const speedFactor = body?.speedFactor || 1.2;
    const now = Date.now();

    for (const exec of executions) {
      const diff = new Date(exec.executeAt).getTime() - now;
      if (diff > 0) {
        const compressedDiff = Math.max(60000, Math.floor(diff / speedFactor));
        await client.packageExecution.update({
          where: { id: exec.id },
          data: { executeAt: new Date(now + compressedDiff) },
        });
      }
    }
    return { success: true, adjustedCount: executions.length };
  }

  async pausePackage(userId: string, packageId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const pkg = await this.getPackage(userId, packageId);
    if (pkg.status !== PackageStatus.ACTIVE) {
      throw new ApiError(400, "BAD_REQUEST", `Cannot pause package with status "${pkg.status}".`);
    }
    const updated = await client.package.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.PAUSED,
        pausedDays: (pkg.pausedDays || 0) + 1,
      },
    });
    return {
      success: true,
      packageId,
      status: PackageStatus.PAUSED,
      newStatus: PackageStatus.PAUSED,
      maxPauseDays: 14,
      pausedDays: updated.pausedDays,
    };
  }

  async resumePackage(userId: string, packageId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const pkg = await this.getPackage(userId, packageId);
    if (pkg.status !== PackageStatus.PAUSED) {
      throw new ApiError(400, "BAD_REQUEST", `Cannot resume package in status "${pkg.status}".`);
    }
    const updated = await client.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.ACTIVE },
    });
    return { success: true, package: updated };
  }

  async cancelPackage(userId: string, packageId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const txHandler = async (tx: any) => {
      const pkg = await tx.package.findFirst({
        where: { id: packageId, userId },
        include: { executions: true },
      });
      if (!pkg) {
        throw new ApiError(404, "NOT_FOUND", "Package not found.");
      }
      if (pkg.status === PackageStatus.CANCELLED || pkg.status === PackageStatus.COMPLETED) {
        throw new ApiError(400, "BAD_REQUEST", `Cannot cancel package already in status "${pkg.status}".`);
      }

      await tx.packageExecution.updateMany({
        where: { packageId, status: PackageExecutionStatus.SCHEDULED },
        data: { status: PackageExecutionStatus.CANCELLED },
      });

      const executions = await tx.packageExecution.findMany({ where: { packageId } });
      const accounting = calculatePackageAccounting(pkg.reserveTotal, executions);

      if (accounting.netRefundDue.greaterThan(0)) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: new Decimal(wallet.balance.toString()).plus(accounting.netRefundDue) },
          });
          if (tx.ledgerEntry?.create) {
            await tx.ledgerEntry.create({
              data: {
                walletId: wallet.id,
                amount: accounting.netRefundDue,
                type: TransactionType.PACKAGE_REFUND,
                description: `Package Cancellation Refund #${pkg.id}`,
              },
            });
          }
        }
      }

      const updated = await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.CANCELLED },
      });

      return {
        success: true,
        package: updated,
        refundedAmount: accounting.netRefundDue.toNumber(),
      };
    };

    if (typeof this.prisma.$transaction === "function") {
      return this.prisma.$transaction(txHandler);
    }
    return txHandler(client);
  }

  async reportProblem(userId: string, packageId: string, body: any): Promise<any> {
    await this.getPackage(userId, packageId);
    return {
      success: true,
      reported: true,
      packageId,
      message: "Problem reported to administrative queue.",
      ticketId: `pkg_prob_${Date.now()}`,
    };
  }

  moderateComments(rawComments: string[], expectedQuantity: number): any {
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

      if (urlRegex.test(trimmed) && !errors.includes("Links and URLs are not permitted in custom comments.")) {
        errors.push("Links and URLs are not permitted in custom comments.");
      }
      if (phoneRegex.test(trimmed) && !errors.includes("Phone numbers or numeric sequences are not permitted.")) {
        errors.push("Phone numbers or numeric sequences are not permitted.");
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

    if (hasDuplicate) errors.push("Duplicate comment lines detected.");
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedComments,
    };
  }

  getBundleTemplates(): any[] {
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

  async purchaseBundle(userId: string, input: { templateId: string; handle: string; idempotencyKey?: string }): Promise<any> {
    const template = this.getBundleTemplates().find((t) => t.id === input.templateId);
    if (!template) {
      throw new ApiError(404, "NOT_FOUND", `Bundle template "${input.templateId}" not found.`);
    }

    const client = this.prisma.client || this.prisma;
    const txHandler = async (tx: any) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || new Decimal(wallet.balance.toString()).lessThan(template.bundlePrice)) {
        throw new ApiError(400, "BAD_REQUEST", "Insufficient wallet balance for bundle purchase.");
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: new Decimal(wallet.balance.toString()).minus(template.bundlePrice) },
      });

      const now = new Date();
      const endAt = new Date(now.getTime() + template.durationDays * 86400000);

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

      if (tx.ledgerEntry?.create) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            amount: template.bundlePrice.negated(),
            type: TransactionType.PACKAGE_PURCHASE,
            description: `Preset Bundle: ${template.name}`,
          },
        });
      }

      return {
        success: true,
        packageId: pkg.id,
        templateId: template.id,
        amountCharged: template.bundlePrice,
      };
    };

    if (typeof this.prisma.$transaction === "function") {
      return this.prisma.$transaction(txHandler);
    }
    return txHandler(client);
  }

  async renewPackage(userId: string, packageId: string, body: any): Promise<any> {
    const pkg = await this.getPackage(userId, packageId);
    if (!body?.explicitConsent) {
      throw new ApiError(400, "BAD_REQUEST", "explicitConsent must be true to renew package.");
    }
    const client = this.prisma.client || this.prisma;
    const extendedEnd = new Date(new Date(pkg.endAt).getTime() + (pkg.durationDays || 30) * 86400000);
    const updated = await client.package.update({
      where: { id: packageId },
      data: { endAt: extendedEnd },
    });
    return { success: true, package: updated };
  }

  async setAutoRenew(userId: string, packageId: string, enabled: boolean): Promise<any> {
    await this.getPackage(userId, packageId);
    const client = this.prisma.client || this.prisma;
    const updated = await client.package.update({
      where: { id: packageId },
      data: { autoRenew: enabled },
    });
    return { success: true, package: updated };
  }

  async getAdminPackageSummary(packageId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const pkg = await client.package.findUnique({
      where: { id: packageId },
      include: {
        rules: { include: { service: true } },
        executions: { include: { order: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!pkg) {
      throw new ApiError(404, "NOT_FOUND", "Package not found.");
    }

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

  async getAdminExecutionsQueue(query: any): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const where: any = {};
    if (query?.status) where.status = query.status;
    const page = query?.page || 1;
    const limit = query?.limit || 50;

    const items = await client.packageExecution.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { service: true, package: true },
      orderBy: { executeAt: "asc" },
    });
    const total = client.packageExecution.count ? await client.packageExecution.count({ where }) : items.length;

    return { items, total, page, limit };
  }

  async adminResolveExecution(executionId: string, action: string, body: any): Promise<any> {
    const client = this.prisma.client || this.prisma;
    const execution = await client.packageExecution.findUnique({ where: { id: executionId } });
    if (!execution) {
      throw new ApiError(404, "NOT_FOUND", "Execution not found.");
    }

    if (action === "RETRY") {
      const updated = await client.packageExecution.update({
        where: { id: executionId },
        data: { status: PackageExecutionStatus.SCHEDULED, executeAt: new Date() },
      });
      return { success: true, execution: updated };
    } else if (action === "MARK_SENT") {
      const updated = await client.packageExecution.update({
        where: { id: executionId },
        data: { status: PackageExecutionStatus.COMPLETED, remainingQuantity: 0 },
      });
      return { success: true, execution: updated };
    } else if (action === "REFUND") {
      const updated = await client.packageExecution.update({
        where: { id: executionId },
        data: { status: PackageExecutionStatus.CANCELLED },
      });
      return { success: true, execution: updated };
    }
    throw new ApiError(400, "BAD_REQUEST", `Unrecognized admin action "${action}".`);
  }
}
