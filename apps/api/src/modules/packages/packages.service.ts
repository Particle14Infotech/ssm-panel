import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PackagesQuoteService } from "./packages-quote.service";
import { InstagramService } from "../instagram/instagram.service";
import { PackageQuoteInput, PackagePurchaseInput } from "@smm/contracts";
import { Decimal } from "decimal.js";
import { TransactionType, PackageStatus, PackageRunStatus } from "@prisma/client";

@Injectable()
export class PackagesService {
  private sandboxPackages = new Map<string, any>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteService: PackagesQuoteService,
    private readonly instagramService: InstagramService
  ) {}

  /**
   * Generates a preview quote for package configuration
   */
  async getQuote(input: PackageQuoteInput) {
    return this.quoteService.calculateQuote(input);
  }

  /**
   * Purchases a package:
   * 1. Re-calculates and locks quotes.
   * 2. Re-validates Instagram connected account ownership and eligibility.
   * 3. Atomic Transaction:
   *    - Row lock on Wallet (SELECT ... FOR UPDATE).
   *    - Verifies balance >= totalCharge.
   *    - Debits wallet.
   *    - Creates immutable PACKAGE_PURCHASE ledger record.
   *    - Creates Package, PackageItem, and PackageRun rows with configuration & entitlement snapshots.
   */
  async purchasePackage(userId: string, input: PackagePurchaseInput) {
    // 1. Validate connection if auto-post is enabled
    if (input.connectionId) {
      await this.instagramService.verifyConnectionEligibility(userId, input.connectionId);
    }

    // 2. Calculate authoritative quote on server
    const quote = await this.quoteService.calculateQuote(input);
    const totalCharge = new Decimal(quote.totalCharge);

    if (!this.prisma.isConnected) {
      // Sandbox fallback
      const packageId = `pkg_sbx_${Date.now()}`;
      const pkg = {
        id: packageId,
        userId,
        name: input.name || `Custom Growth Package (${input.days} Days)`,
        connectionId: input.connectionId || null,
        autoPostEnabled: input.autoPostEnabled ?? true,
        durationDays: input.days,
        status: "ACTIVE",
        totalRuns: quote.totalRuns,
        completedRuns: 0,
        failedRuns: 0,
        cancelledRuns: 0,
        postsDetected: 0,
        postsProcessed: 0,
        totalCharge: quote.totalCharge,
        refundedAmount: 0,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + input.days * 24 * 3600 * 1000).toISOString(),
        items: quote.items,
        runs: quote.timeline.map((t, idx) => ({
          id: `run_${idx}`,
          packageId,
          ...t,
          status: "SCHEDULED",
        })),
        createdAt: new Date().toISOString(),
      };
      this.sandboxPackages.set(packageId, pkg);
      return { success: true, package: pkg };
    }

    // 3. Check Idempotency
    if (input.idempotencyKey) {
      const existing = await this.prisma.package.findUnique({
        where: {
          unique_package_idempotency_per_user: {
            userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { items: true, runs: true },
      });
      if (existing) {
        return { success: true, package: existing };
      }
    }

    // 4. Atomic Purchase Execution
    return await this.prisma.$transaction(async (tx) => {
      // 4a. Pessimistic lock on User's Wallet
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance, currency FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );

      if (!walletRow) {
        throw new BadRequestException("Wallet not found for user.");
      }

      const currentBalance = new Decimal(walletRow.balance.toString());
      if (currentBalance.lessThan(totalCharge)) {
        throw new BadRequestException(
          `Insufficient wallet balance. Required: ₹${totalCharge.toFixed(2)}, Available: ₹${currentBalance.toFixed(2)}.`
        );
      }

      const newBalance = currentBalance.minus(totalCharge);

      // 4b. Debit wallet balance
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 4c. Create Package record with snapshots
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + input.days * (input.intervalHours || 24) * 3600 * 1000
      );
      const pkg = await tx.package.create({
        data: {
          userId,
          connectionId: input.connectionId || null,
          name: input.name || `Growth Package (${input.days} Days)`,
          status: PackageStatus.ACTIVE,
          durationDays: input.days,
          autoPostEnabled: input.autoPostEnabled ?? true,
          totalRuns: quote.totalRuns,
          completedRuns: 0,
          failedRuns: 0,
          cancelledRuns: 0,
          postsDetected: 0,
          postsProcessed: 0,
          totalCharge,
          refundedAmount: new Decimal(0),
          configurationSnapshot: input as any,
          entitlementSnapshot: quote.items as any,
          idempotencyKey: input.idempotencyKey || null,
          startDate,
          endDate,
        },
      });

      // 4d. Write Ledger Entry (Immutable double-entry debit)
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: totalCharge.negated(),
          type: TransactionType.PACKAGE_PURCHASE,
          referenceId: `PKG_${pkg.id}`,
          idempotencyKey: input.idempotencyKey,
          description: `Package Purchase: ${pkg.name} (${input.days} days, ${quote.items.length} services)`,
        },
      });

      // 4e. Insert Package Items and initial Runs
      for (const item of quote.items) {
        const matchingInputItem = input.items.find((i) => i.serviceId === item.serviceId);
        const pkgItem = await tx.packageItem.create({
          data: {
            packageId: pkg.id,
            serviceId: item.serviceId,
            target: item.target,
            targetType: item.targetType,
            totalQuantity: item.totalQuantity,
            charge: new Decimal(item.charge),
            sellRatePer1kSnapshot: new Decimal(item.ratePer1000),
            enabled: matchingInputItem?.enabled ?? true,
            quantityPerPost: matchingInputItem?.quantityPerPost ?? 0,
            maximumPostsToProcess: matchingInputItem?.maximumPostsToProcess ?? 100,
            delayAfterPublication: matchingInputItem?.delayAfterPublication || 0,
            eligibleMediaTypes: matchingInputItem?.eligibleMediaTypes || ["REEL", "IMAGE", "VIDEO"],
            usageLimit: item.totalQuantity,
            usageConsumed: 0,
          },
        });

        const itemRuns = quote.timeline.filter(
          (t) => t.serviceId === item.serviceId && t.target === item.target
        );
        const runsData = itemRuns.map((r) => ({
          packageId: pkg.id,
          packageItemId: pkgItem.id,
          runIndex: r.runIndex,
          scheduledAt: new Date(r.scheduledAt),
          quantity: r.quantity,
          chargeShare: new Decimal(r.chargeShare),
          status: PackageRunStatus.SCHEDULED,
          attempts: 0,
        }));

        await tx.packageRun.createMany({
          data: runsData,
        });
      }

      return {
        success: true,
        package: {
          id: pkg.id,
          name: pkg.name,
          connectionId: pkg.connectionId,
          totalCharge: totalCharge.toNumber(),
          totalRuns: quote.totalRuns,
          days: input.days,
          startDate: pkg.startDate.toISOString(),
          endDate: pkg.endDate.toISOString(),
        },
      };
    });
  }

  /**
   * Lists customer's packages with progress summary
   */
  async listPackages(userId: string) {
    if (!this.prisma.isConnected) {
      return Array.from(this.sandboxPackages.values()).filter((p) => p.userId === userId);
    }

    const packages = await this.prisma.package.findMany({
      where: { userId },
      include: {
        connection: {
          select: {
            id: true,
            username: true,
            platformAccountId: true,
            connectionStatus: true,
          },
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                displayName: true,
                platform: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return packages.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      connectionId: p.connectionId,
      connectedAccount: p.connection ? `@${p.connection.username}` : null,
      autoPostEnabled: p.autoPostEnabled,
      durationDays: p.durationDays,
      totalRuns: p.totalRuns,
      completedRuns: p.completedRuns,
      failedRuns: p.failedRuns,
      cancelledRuns: p.cancelledRuns,
      postsDetected: p.postsDetected,
      postsProcessed: p.postsProcessed,
      totalCharge: Number(p.totalCharge),
      refundedAmount: Number(p.refundedAmount),
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
      items: p.items.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        serviceName: i.service?.displayName || i.service?.name || "Service",
        platform: i.service?.platform || "PLATFORM",
        target: i.target,
        targetType: i.targetType,
        totalQuantity: i.totalQuantity,
        quantityPerPost: i.quantityPerPost,
        delayAfterPublication: i.delayAfterPublication,
        eligibleMediaTypes: i.eligibleMediaTypes,
        usageLimit: i.usageLimit,
        usageConsumed: i.usageConsumed,
        charge: Number(i.charge),
      })),
    }));
  }

  /**
   * Retrieves single package with items, runs, and execution status
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
        connection: {
          select: {
            id: true,
            username: true,
            platformAccountId: true,
            connectionStatus: true,
            lastDetectedAt: true,
          },
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                displayName: true,
                platform: true,
                ratePer1000: true,
              },
            },
          },
        },
        runs: {
          orderBy: { scheduledAt: "asc" },
          include: {
            packageItem: {
              select: {
                target: true,
                service: { select: { name: true, displayName: true, platform: true } },
              },
            },
            childOrder: {
              select: { id: true, status: true, startCount: true, remains: true },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException("Package not found.");
    }

    return {
      id: pkg.id,
      name: pkg.name,
      status: pkg.status,
      connectionId: pkg.connectionId,
      connection: pkg.connection
        ? {
            id: pkg.connection.id,
            username: pkg.connection.username,
            platformAccountId: pkg.connection.platformAccountId,
            connectionStatus: pkg.connection.connectionStatus,
            lastDetectedAt: pkg.connection.lastDetectedAt
              ? pkg.connection.lastDetectedAt.toISOString()
              : null,
          }
        : null,
      autoPostEnabled: pkg.autoPostEnabled,
      durationDays: pkg.durationDays,
      totalRuns: pkg.totalRuns,
      completedRuns: pkg.completedRuns,
      failedRuns: pkg.failedRuns,
      cancelledRuns: pkg.cancelledRuns,
      postsDetected: pkg.postsDetected,
      postsProcessed: pkg.postsProcessed,
      totalCharge: Number(pkg.totalCharge),
      refundedAmount: Number(pkg.refundedAmount),
      startDate: pkg.startDate.toISOString(),
      endDate: pkg.endDate.toISOString(),
      createdAt: pkg.createdAt.toISOString(),
      items: pkg.items.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        serviceName: i.service?.displayName || i.service?.name,
        platform: i.service?.platform,
        target: i.target,
        targetType: i.targetType,
        totalQuantity: i.totalQuantity,
        quantityPerPost: i.quantityPerPost,
        delayAfterPublication: i.delayAfterPublication,
        eligibleMediaTypes: i.eligibleMediaTypes,
        usageLimit: i.usageLimit,
        usageConsumed: i.usageConsumed,
        charge: Number(i.charge),
      })),
      runs: pkg.runs.map((r) => ({
        id: r.id,
        runIndex: r.runIndex,
        scheduledAt: r.scheduledAt.toISOString(),
        quantity: r.quantity,
        chargeShare: Number(r.chargeShare),
        status: r.status,
        serviceName: r.packageItem?.service?.displayName || r.packageItem?.service?.name,
        platform: r.packageItem?.service?.platform,
        target: r.packageItem?.target,
        childOrderId: r.childOrder?.id || null,
        childOrderStatus: r.childOrder?.status || null,
      })),
    };
  }

  /**
   * Pauses an active package
   */
  async pausePackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = "PAUSED";
      return { success: true, status: "PAUSED" };
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

    return { success: true, status: "PAUSED" };
  }

  /**
   * Resumes a paused package
   */
  async resumePackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = "ACTIVE";
      return { success: true, status: "ACTIVE" };
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

    return { success: true, status: "ACTIVE" };
  }

  /**
   * Retrieves all detected posts associated with this package's connection
   */
  async getPackagePosts(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      return [];
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    if (!pkg.connectionId) {
      return [];
    }

    const posts = await this.prisma.monitoredMedia.findMany({
      where: { connectionId: pkg.connectionId },
      orderBy: { publishedAt: "desc" },
      include: {
        executions: {
          where: { packageId },
          select: {
            id: true,
            status: true,
            actionType: true,
            scheduledAt: true,
            completedAt: true,
            attempts: true,
            errorMessage: true,
          },
        },
      },
    });

    return posts.map((p) => ({
      id: p.id,
      mediaId: p.mediaId,
      permalink: p.permalink,
      mediaType: p.mediaType,
      caption: p.caption,
      publishedAt: p.publishedAt.toISOString(),
      firstDetectedAt: p.firstDetectedAt.toISOString(),
      executions: p.executions.map((e) => ({
        id: e.id,
        status: e.status,
        actionType: e.actionType,
        scheduledAt: e.scheduledAt.toISOString(),
        completedAt: e.completedAt ? e.completedAt.toISOString() : null,
        attempts: e.attempts,
        errorMessage: e.errorMessage,
      })),
    }));
  }

  /**
   * Retrieves full automation execution history for this package
   */
  async getPackageExecutions(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      return [];
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
    });
    if (!pkg) throw new NotFoundException("Package not found.");

    const executions = await this.prisma.automationExecution.findMany({
      where: { packageId },
      orderBy: { scheduledAt: "desc" },
      include: {
        packageItem: {
          select: {
            serviceId: true,
            quantityPerPost: true,
            service: { select: { displayName: true, name: true, platform: true } },
          },
        },
        monitoredMedia: {
          select: {
            mediaId: true,
            permalink: true,
            mediaType: true,
            publishedAt: true,
          },
        },
      },
    });

    return executions.map((e) => ({
      id: e.id,
      packageId: e.packageId,
      mediaId: e.mediaId,
      mediaPermalink: e.monitoredMedia?.permalink || null,
      mediaType: e.monitoredMedia?.mediaType || null,
      serviceName:
        e.packageItem?.service?.displayName || e.packageItem?.service?.name || "Service",
      actionType: e.actionType,
      status: e.status,
      scheduledAt: e.scheduledAt.toISOString(),
      startedAt: e.startedAt ? e.startedAt.toISOString() : null,
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
      attempts: e.attempts,
      providerReference: e.providerReference,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
    }));
  }

  /**
   * Cancels remaining unexecuted runs of a package and issues
   * an atomic exact-cents refund back to the customer's wallet.
   */
  async cancelPackage(userId: string, packageId: string) {
    if (!this.prisma.isConnected) {
      const pkg = this.sandboxPackages.get(packageId);
      if (!pkg || pkg.userId !== userId) throw new NotFoundException("Package not found.");
      pkg.status = "CANCELLED";
      return { success: true, refundedAmount: 0 };
    }

    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, userId },
      include: { runs: true },
    });

    if (!pkg) {
      throw new NotFoundException("Package not found.");
    }

    if (pkg.status === PackageStatus.CANCELLED || pkg.status === PackageStatus.COMPLETED) {
      throw new BadRequestException(`Cannot cancel a package with status "${pkg.status}".`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock wallet row
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        userId
      );
      if (!walletRow) {
        throw new BadRequestException("Wallet not found.");
      }

      // 2. Fetch and cancel all SCHEDULED runs
      const scheduledRuns = await tx.packageRun.findMany({
        where: {
          packageId: pkg.id,
          status: PackageRunStatus.SCHEDULED,
        },
      });

      // 3. Cancel any pending or scheduled AutomationExecution records
      await tx.automationExecution.updateMany({
        where: {
          packageId: pkg.id,
          status: { in: ["SCHEDULED", "PENDING"] },
        },
        data: {
          status: "CANCELLED",
        },
      });

      // 4. Calculate exact refund amount
      let refundAmount = new Decimal(0);
      for (const run of scheduledRuns) {
        refundAmount = refundAmount.plus(new Decimal(run.chargeShare.toString()));
      }

      // 5. Mark runs as CANCELLED
      if (scheduledRuns.length > 0) {
        await tx.packageRun.updateMany({
          where: {
            packageId: pkg.id,
            status: PackageRunStatus.SCHEDULED,
          },
          data: {
            status: PackageRunStatus.CANCELLED,
          },
        });
      }

      // 6. Update package status and refund stats
      const newStatus =
        pkg.completedRuns > 0 || pkg.postsProcessed > 0
          ? PackageStatus.PARTIAL
          : PackageStatus.CANCELLED;

      await tx.package.update({
        where: { id: pkg.id },
        data: {
          status: newStatus,
          cancelledRuns: { increment: scheduledRuns.length },
          refundedAmount: { increment: refundAmount },
        },
      });

      // 7. Credit wallet and write PACKAGE_REFUND ledger record
      if (refundAmount.greaterThan(0)) {
        const currentBalance = new Decimal(walletRow.balance.toString());
        const newBalance = currentBalance.plus(refundAmount);

        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: newBalance },
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: refundAmount,
            type: TransactionType.PACKAGE_REFUND,
            referenceId: `REF_PKG_${pkg.id}_${Date.now()}`,
            description: `Package Cancellation Refund for #${pkg.id} (${scheduledRuns.length} unexecuted runs)`,
          },
        });
      }

      return {
        success: true,
        refundedAmount: refundAmount.toNumber(),
        cancelledRunsCount: scheduledRuns.length,
      };
    });
  }
}
