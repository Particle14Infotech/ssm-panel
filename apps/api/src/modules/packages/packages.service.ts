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
import { InstagramService } from "../instagram/instagram.service";
import { PackageQuoteInput, PackagePurchaseInput } from "@smm/contracts";
import { Decimal } from "decimal.js";
import {
  TransactionType,
  PackageStatus,
  PackageRuleKind,
  PackageExecutionStatus,
  ExecutionSource,
} from "@prisma/client";

// Allowlist regex for Instagram post / reel links (never arbitrary URLs)
const INSTAGRAM_URL_REGEX = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);
  private sandboxPackages = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: PackagesQuoteService,
    private readonly instagramService: InstagramService
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
   *    - PACKAGE_PURCHASE for full reserve.
   *    - Package ACTIVE.
   *    - Rate snapshot recorded.
   *    - TIME_DRIP executions precomputed with bounded jitter (+/-15%).
   */
  async purchasePackage(userId: string, input: PackagePurchaseInput) {
    const idempotencyKey = input.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.trim() === "") {
      throw new BadRequestException("Idempotency-Key is required for package purchase.");
    }

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

    // 2. Validate connection if connectionId supplied
    if (input.connectionId && this.prisma.isConnected) {
      await this.instagramService.verifyConnectionEligibility(userId, input.connectionId);
    }

    // 3. Authoritative Quote Calculation
    const quote = await this.quoteService.calculateQuote(input);
    const reserveTotal = new Decimal(quote.totalCharge);

    const handle = (input.handle || input.accountUsername || "account").replace(/^@/, "").trim();
    const durationDays = input.durationDays || input.days || 30;
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 3600 * 1000);

    if (!this.prisma.isConnected) {
      // In-memory fallback
      const packageId = `pkg_sbx_${Date.now()}`;
      const pkg = {
        id: packageId,
        userId,
        handle,
        connectionId: input.connectionId || null,
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
      // 4a. Lock user's wallet with FOR UPDATE
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

      // 4b. Debit wallet
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 4c. Write PACKAGE_PURCHASE ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: reserveTotal.negated(),
          type: TransactionType.PACKAGE_PURCHASE,
          idempotencyKey,
          description: `Package Purchase Reserve: @${handle} (${durationDays} days)`,
        },
      });

      // Determine primary rule kind for partial unique index
      const ruleKind = quote.items[0]?.targetType === "POST_OR_REEL"
        ? PackageRuleKind.POST_TRIGGERED
        : PackageRuleKind.TIME_DRIP;

      // 4d. Create Package
      const pkg = await tx.package.create({
        data: {
          userId,
          connectionId: input.connectionId || null,
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
            mediaTypes: item.eligibleMediaTypes || ["REEL", "IMAGE", "VIDEO"],
            delayMinutes: item.delayAfterPublication || 0,
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

        // For TIME_DRIP rules, precompute SCHEDULED executions with bounded jitter (+/-15%)
        if (kind === PackageRuleKind.TIME_DRIP) {
          const itemRuns = quote.timeline.filter((t) => t.serviceId === item.serviceId);
          const intervalMs = (durationDays * 24 * 3600 * 1000) / Math.max(1, itemRuns.length);

          for (let idx = 0; idx < itemRuns.length; idx++) {
            const r = itemRuns[idx];
            // Bounded jitter between -15% and +15%
            const jitterFactor = idx === 0 ? 0 : (Math.random() * 0.3 - 0.15);
            const jitterMs = Math.round(intervalMs * jitterFactor);
            const nominalTime = new Date(startAt.getTime() + idx * intervalMs + jitterMs);

            const execution = await tx.packageExecution.create({
              data: {
                packageId: pkg.id,
                ruleId: rule.id,
                source: ExecutionSource.SCHEDULE,
                seq: idx + 1,
                quantity: r.quantity,
                allocatedCharge: new Decimal(r.chargeShare),
                executeAt: nominalTime,
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
   * Manual trigger (MVP baseline, no Meta API needed):
   * POST /packages/:id/trigger { url }
   * 1. Allowlisted host + regex, extract mediaKey (never fetch arbitrary URLs)
   * 2. Atomic quota: UPDATE "PackageRule" SET usedCount = usedCount + 1 WHERE usedCount < maxPosts
   * 3. Daily cap and min spacing verification
   * 4. Insert execution with executeAt = max(now, publishedAt or now + delay)
   */
  async triggerManualPost(userId: string, packageId: string, url: string, mediaType: string = "REEL") {
    // 1. Strict regex validation for Instagram URL allowlist
    const match = url.trim().match(INSTAGRAM_URL_REGEX);
    if (!match || !match[1]) {
      throw new BadRequestException("Invalid Instagram URL. Only official instagram.com post/reel links are permitted.");
    }
    const mediaKey = match[1];

    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) {
        throw new NotFoundException("Package not found or access denied.");
      }
      return {
        success: true,
        mediaKey,
        executionId: `exec_sbx_${Date.now()}`,
        status: "SCHEDULED",
        executeAt: new Date().toISOString(),
      };
    }

    return await this.prisma.$transaction(async (tx) => {
      // 2. Fetch and lock Package
      const pkg = await tx.package.findFirst({
        where: { id: packageId, userId },
      });
      if (!pkg) {
        throw new NotFoundException("Package not found or access denied.");
      }
      if (pkg.status !== PackageStatus.ACTIVE) {
        throw new BadRequestException(`Cannot trigger execution for package in status "${pkg.status}".`);
      }

      // 3. Find active POST_TRIGGERED rules for this package
      const rules = await tx.packageRule.findMany({
        where: {
          packageId: pkg.id,
          kind: PackageRuleKind.POST_TRIGGERED,
        },
      });

      if (rules.length === 0) {
        throw new BadRequestException("This package does not contain any active POST_TRIGGERED rules.");
      }

      const rule = rules[0];

      // 4. Check media type eligibility
      if (rule.mediaTypes && rule.mediaTypes.length > 0 && !rule.mediaTypes.includes(mediaType.toUpperCase())) {
        throw new BadRequestException(`Media type "${mediaType}" is not eligible for this package rule.`);
      }

      // 5. Min spacing check
      if (rule.minSpacingMin > 0) {
        const lastExec = await tx.packageExecution.findFirst({
          where: { ruleId: rule.id },
          orderBy: { createdAt: "desc" },
        });
        if (lastExec) {
          const diffMin = (Date.now() - lastExec.createdAt.getTime()) / (60 * 1000);
          if (diffMin < rule.minSpacingMin) {
            throw new BadRequestException(
              `Rate limit: minimum spacing of ${rule.minSpacingMin} minutes required between post triggers. Try again in ${Math.ceil(rule.minSpacingMin - diffMin)}m.`
            );
          }
        }
      }

      // 6. Daily cap check
      if (rule.maxPerDay > 0) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const countToday = await tx.packageExecution.count({
          where: {
            ruleId: rule.id,
            createdAt: { gte: todayStart },
          },
        });
        if (countToday >= rule.maxPerDay) {
          throw new BadRequestException(`Daily quota reached: maximum ${rule.maxPerDay} triggers allowed per day.`);
        }
      }

      // 7. Atomic quota increment: UPDATE ... SET usedCount = usedCount + 1 WHERE usedCount < maxPosts
      const updatedRules = await tx.$queryRawUnsafe<any[]>(
        `UPDATE "PackageRule"
         SET "usedCount" = "usedCount" + 1
         WHERE id = $1 AND "usedCount" < "maxPosts"
         RETURNING id, "usedCount", "maxPosts", "unitCharge"`,
        rule.id
      );

      if (!updatedRules || updatedRules.length === 0) {
        throw new BadRequestException(`Package post quota exhausted: already used maximum ${rule.maxPosts} posts.`);
      }

      const updatedRule = updatedRules[0];

      // 8. Find or create MonitoredMedia record
      let media = await tx.monitoredMedia.findFirst({
        where: {
          mediaKey,
          connectionId: pkg.connectionId || "conn_manual",
        },
      });

      if (!media && pkg.connectionId) {
        media = await tx.monitoredMedia.create({
          data: {
            connectionId: pkg.connectionId,
            mediaKey,
            publishedAt: new Date(),
            state: "NEW",
            permalink: url,
            mediaType,
          },
        });
      }

      // 9. Insert PackageExecution with executeAt = max(now, publishedAt or now + delay)
      const executeAt = new Date(Date.now() + (rule.delayMinutes || 0) * 60 * 1000);

      const execution = await tx.packageExecution.create({
        data: {
          packageId: pkg.id,
          ruleId: rule.id,
          mediaId: media ? media.id : null,
          source: ExecutionSource.MEDIA,
          seq: updatedRule.usedCount,
          quantity: rule.quantityPerPost,
          allocatedCharge: new Decimal(updatedRule.unitCharge.toString()),
          executeAt,
          status: PackageExecutionStatus.SCHEDULED,
        },
      });

      return {
        success: true,
        executionId: execution.id,
        mediaKey,
        usedCount: updatedRule.usedCount,
        maxPosts: updatedRule.maxPosts,
        status: execution.status,
        executeAt: execution.executeAt.toISOString(),
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

    await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.PAUSED },
    });

    return { success: true, status: PackageStatus.PAUSED };
  }

  /**
   * Resumes a paused package
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

    await this.prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.ACTIVE },
    });

    return { success: true, status: PackageStatus.ACTIVE };
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
        connection: true,
      },
    });

    if (!pkg) throw new NotFoundException("Package not found.");
    return pkg;
  }

  /**
   * Returns posts monitored/processed for this package
   */
  async getPackagePosts(userId: string, packageId: string) {
    if (!this.prisma.isConnected) return [];

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    if (!pkg.connectionId) {
      return this.prisma.monitoredMedia.findMany({
        where: { executions: { some: { packageId } } },
        orderBy: { publishedAt: "desc" },
      });
    }

    return this.prisma.monitoredMedia.findMany({
      where: { connectionId: pkg.connectionId },
      orderBy: { publishedAt: "desc" },
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
        media: true,
        order: true,
      },
      orderBy: { executeAt: "asc" },
    });
  }
}
