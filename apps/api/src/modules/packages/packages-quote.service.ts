import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PackageQuoteInput, PackageQuoteResponse, PackageRunPreview } from "@smm/contracts";
import { Decimal } from "decimal.js";

const DEFAULT_MARGIN_FLOOR = 0.15; // 15% floor

export interface NormalizedRule {
  kind: "POST_TRIGGERED" | "TIME_DRIP";
  serviceId: string;
  quantityPerPost: number;
  totalQuantity: number;
  mediaTypes: string[];
  delayMinutes: number;
  deliveryWindowMin: number;
  maxPosts: number;
  maxPerDay: number;
  minSpacingMin: number;
  target?: string;
  targetType?: string;
}

@Injectable()
export class PackagesQuoteService {
  private readonly logger = new Logger(PackagesQuoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure quote calculation with zero DB side effects.
   * Guarantees:
   * 1. unitCharge = ceil(rateSnapshot x quantityPerPost / 1000)
   * 2. POST_TRIGGERED reserve = unitCharge x maxPosts
   * 3. TIME_DRIP reserve = ceil(rate x totalQty / 1000) split over runs, last run absorbs remainder
   * 4. sum(run.quantity) === totalQty and sum(run.chargeShare) === reserve
   * 5. Warning if Q is too small to split across durationDays
   * 6. Admin alert logged when margin < floor
   */
  async calculateQuote(input: PackageQuoteInput): Promise<PackageQuoteResponse> {
    const durationDays = input.durationDays || input.days || 30;
    const intervalHours = input.intervalHours || 24;
    const warnings: string[] = [];

    // 1. Normalize input rules (supports new 'rules' and legacy 'items')
    const normalizedRules: NormalizedRule[] = [];

    if (input.rules && input.rules.length > 0) {
      for (const r of input.rules) {
        normalizedRules.push({
          kind: r.kind,
          serviceId: r.serviceId,
          quantityPerPost: r.quantityPerPost || 0,
          totalQuantity: r.totalQuantity || (r.quantityPerPost ? r.quantityPerPost * (r.maxPosts || 1) : 0),
          mediaTypes: r.mediaTypes || ["REEL", "IMAGE", "VIDEO"],
          delayMinutes: r.delayMinutes || 0,
          deliveryWindowMin: r.deliveryWindowMin || 0,
          maxPosts: r.maxPosts || (r.kind === "POST_TRIGGERED" ? 10 : 1),
          maxPerDay: r.maxPerDay || 0,
          minSpacingMin: r.minSpacingMin || 0,
        });
      }
    } else if (input.items && input.items.length > 0) {
      for (const rawItem of input.items) {
        const item = rawItem as any;
        const isPostTriggered = item.targetType === "POST_OR_REEL" && (item.quantityPerPost || 0) > 0;
        const maxPosts = item.runs || item.maximumPostsToProcess || (isPostTriggered && item.quantity && item.quantityPerPost ? Math.floor(item.quantity / item.quantityPerPost) : (isPostTriggered ? 10 : 1));
        const totalQuantity = item.totalQuantity || item.quantity || (item.quantityPerPost ? item.quantityPerPost * maxPosts : 0);
        const quantityPerPost = item.quantityPerPost || (totalQuantity ? Math.floor(totalQuantity / maxPosts) : 0);

        normalizedRules.push({
          kind: isPostTriggered ? "POST_TRIGGERED" : "TIME_DRIP",
          serviceId: item.serviceId,
          quantityPerPost,
          totalQuantity,
          mediaTypes: item.eligibleMediaTypes || ["REEL", "IMAGE", "VIDEO"],
          delayMinutes: item.delayAfterPublication || 0,
          deliveryWindowMin: 0,
          maxPosts,
          maxPerDay: 0,
          minSpacingMin: item.minimumIntervalBetweenActions || 0,
          target: item.target,
          targetType: item.targetType,
        });
      }
    } else {
      throw new BadRequestException("At least one package rule or item is required.");
    }

    // 2. Resolve connected account metadata (read-only)
    let connectionData: PackageQuoteResponse["connection"] = null;
    if (input.connectionId) {
      if (this.prisma.isConnected) {
        const conn = await this.prisma.sourceConnection.findUnique({
          where: { id: input.connectionId },
        });
        if (conn) {
          connectionData = {
            id: conn.id,
            username: conn.username,
            accountType: "BUSINESS",
            connectionStatus: conn.status === "ACTIVE" ? "CONNECTED" : "RECONNECT_REQUIRED",
          };
          if (conn.status !== "ACTIVE") {
            warnings.push(`Account @${conn.username} status is ${conn.status}. Reconnection may be required.`);
          }
        } else {
          warnings.push("Specified connection ID could not be found.");
        }
      } else {
        connectionData = {
          id: input.connectionId,
          username: input.accountUsername || input.handle || "demo_account",
          accountType: "BUSINESS",
          connectionStatus: "CONNECTED",
        };
      }
    }

    // 3. Fetch all requested services in bulk
    const serviceIds = [...new Set(normalizedRules.map((r) => r.serviceId))];
    let services: any[] = [];

    if (this.prisma.isConnected) {
      services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, isDeleted: false },
      });
    } else {
      services = serviceIds.map((id) => ({
        id,
        name: `Service #${id}`,
        displayName: `Service #${id}`,
        platform: "INSTAGRAM",
        ratePer1000: new Decimal(120.0),
        minQty: 10,
        maxQty: 500000,
        costINR: new Decimal(90.0),
        status: "ACTIVE",
      }));
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // 4. Compute quotes and timeline
    let packageReserveTotal = new Decimal(0);
    const calculatedItems: PackageQuoteResponse["items"] = [];
    const allRuns: PackageRunPreview[] = [];
    const now = new Date();

    for (const rule of normalizedRules) {
      const svc = serviceMap.get(rule.serviceId);
      if (!svc) {
        throw new BadRequestException(`Service with ID "${rule.serviceId}" not found or discontinued.`);
      }
      if (svc.status !== "ACTIVE") {
        throw new BadRequestException(`Service "${svc.displayName || svc.name}" is currently unavailable.`);
      }

      const ratePer1k = new Decimal(svc.ratePer1000.toString());

      // Margin Floor Check & Admin Alert
      const costRate = svc.costINR
        ? new Decimal(svc.costINR.toString())
        : svc.providerCostPer1k
          ? new Decimal(svc.providerCostPer1k.toString())
          : null;

      if (costRate && ratePer1k.greaterThan(0)) {
        const margin = ratePer1k.minus(costRate).dividedBy(ratePer1k).toNumber();
        if (margin < DEFAULT_MARGIN_FLOOR) {
          const warnMsg = `Margin alert: Service "${svc.displayName || svc.name}" margin is ${(margin * 100).toFixed(1)}%, below the floor threshold of ${DEFAULT_MARGIN_FLOOR * 100}%.`;
          this.logger.warn(`[PackagesQuote] ${warnMsg}`);
          warnings.push(warnMsg);
        }
      }

      if (rule.kind === "POST_TRIGGERED") {
        // Validation for per-post quantities
        if (rule.quantityPerPost < svc.minQty) {
          throw new BadRequestException(
            `Quantity per post (${rule.quantityPerPost}) on "${svc.displayName || svc.name}" is below service minimum of ${svc.minQty}.`
          );
        }
        if (rule.quantityPerPost > svc.maxQty) {
          throw new BadRequestException(
            `Quantity per post (${rule.quantityPerPost}) on "${svc.displayName || svc.name}" exceeds service maximum of ${svc.maxQty}.`
          );
        }

        // unitCharge = ceil(rateSnapshot x quantityPerPost / 1000)
        const unitCharge = new Decimal(ratePer1k)
          .times(rule.quantityPerPost)
          .dividedBy(1000)
          .toDecimalPlaces(2, Decimal.ROUND_CEIL);

        // POST_TRIGGERED reserve = unitCharge x maxPosts
        const ruleReserve = unitCharge.times(rule.maxPosts).toDecimalPlaces(2, Decimal.ROUND_CEIL);
        packageReserveTotal = packageReserveTotal.plus(ruleReserve);

        calculatedItems.push({
          serviceId: svc.id,
          serviceName: svc.displayName || svc.name,
          target: rule.target || `@${input.handle || input.accountUsername || "account"}`,
          targetType: (rule.targetType as any) || "POST_OR_REEL",
          totalQuantity: rule.quantityPerPost * rule.maxPosts,
          quantityPerPost: rule.quantityPerPost,
          delayAfterPublication: rule.delayMinutes,
          eligibleMediaTypes: rule.mediaTypes,
          charge: ruleReserve.toNumber(),
          ratePer1000: ratePer1k.toNumber(),
          runs: rule.maxPosts,
          minQty: svc.minQty,
          maxQty: svc.maxQty,
        });

        // Add note to timeline
        allRuns.push({
          runIndex: 1,
          scheduledAt: new Date(now.getTime() + rule.delayMinutes * 60 * 1000).toISOString(),
          serviceId: svc.id,
          serviceName: `${svc.displayName || svc.name} (Trigger per post: starts within about ${Math.max(5, rule.delayMinutes)} minutes of post detection)`,
          target: rule.target || `@${input.handle || input.accountUsername || "account"}`,
          quantity: rule.quantityPerPost,
          chargeShare: unitCharge.toNumber(),
        });
      } else {
        // TIME_DRIP
        const totalQty = rule.totalQuantity;
        if (totalQty < svc.minQty) {
          throw new BadRequestException(
            `Total quantity (${totalQty}) on "${svc.displayName || svc.name}" is below service minimum of ${svc.minQty}.`
          );
        }

        const runsPerDay = Math.max(1, Math.floor(24 / intervalHours));
        const maxAllowedRuns = Math.max(1, durationDays * runsPerDay);
        // runs = clamp(floor(Q / serviceMin), 1, durationDays x runsPerDay)
        const calculatedRuns = Math.min(Math.max(1, Math.floor(totalQty / svc.minQty)), maxAllowedRuns);

        if (calculatedRuns === 1 && durationDays > 1) {
          warnings.push(
            `Quantity (${totalQty}) on "${svc.displayName || svc.name}" is too small to split across ${durationDays} days (service minimum per run is ${svc.minQty}). A single run will be scheduled.`
          );
        }

        // TIME_DRIP reserve = ceil(rate x totalQty / 1000)
        const ruleReserve = new Decimal(ratePer1k)
          .times(totalQty)
          .dividedBy(1000)
          .toDecimalPlaces(2, Decimal.ROUND_CEIL);

        packageReserveTotal = packageReserveTotal.plus(ruleReserve);

        // Precompute run splits
        const baseQty = Math.floor(totalQty / calculatedRuns);
        const remQty = totalQty % calculatedRuns;

        const runQuantities: number[] = [];
        for (let r = 0; r < calculatedRuns; r++) {
          runQuantities.push(r < remQty ? baseQty + 1 : baseQty);
        }

        // Split charge over runs: last run takes the remainder so sum equals reserve exactly
        const runChargeShares: Decimal[] = [];
        let runningSum = new Decimal(0);

        for (let r = 0; r < calculatedRuns; r++) {
          if (r === calculatedRuns - 1) {
            const lastShare = ruleReserve.minus(runningSum);
            runChargeShares.push(lastShare);
          } else {
            const share = new Decimal(runQuantities[r])
              .times(ratePer1k)
              .dividedBy(1000)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            runChargeShares.push(share);
            runningSum = runningSum.plus(share);
          }
        }

        // Generate schedule preview with bounded jitter
        for (let r = 0; r < calculatedRuns; r++) {
          const offsetHours = r * (24 / runsPerDay);
          const scheduledTime = new Date(now.getTime() + offsetHours * 3600 * 1000);

          allRuns.push({
            runIndex: r + 1,
            scheduledAt: scheduledTime.toISOString(),
            serviceId: svc.id,
            serviceName: `${svc.displayName || svc.name} (Delivery starts within about 10-30 minutes of scheduled run)`,
            target: rule.target || `@${input.handle || input.accountUsername || "account"}`,
            quantity: runQuantities[r],
            chargeShare: runChargeShares[r].toNumber(),
          });
        }

        calculatedItems.push({
          serviceId: svc.id,
          serviceName: svc.displayName || svc.name,
          target: rule.target || `@${input.handle || input.accountUsername || "account"}`,
          targetType: (rule.targetType as any) || "PROFILE",
          totalQuantity: totalQty,
          quantityPerPost: runQuantities[0] || totalQty,
          delayAfterPublication: 0,
          eligibleMediaTypes: [],
          charge: ruleReserve.toNumber(),
          ratePer1000: ratePer1k.toNumber(),
          runs: calculatedRuns,
          minQty: svc.minQty,
          maxQty: svc.maxQty,
        });
      }
    }

    allRuns.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    return {
      valid: true,
      totalCharge: packageReserveTotal.toNumber(),
      totalRuns: allRuns.length,
      days: durationDays,
      autoPostEnabled: input.autoPostEnabled ?? true,
      connection: connectionData,
      items: calculatedItems,
      timeline: allRuns,
      warnings,
    };
  }
}
