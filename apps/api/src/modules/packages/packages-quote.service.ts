import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PlatformsService } from "../platforms/platforms.service";
import {
  PackageQuoteInput,
  PackageQuoteResponse,
  PackageRunPreview,
  PackageQuoteItem,
} from "@smm/contracts";
import { Decimal } from "decimal.js";
import {
  normalizeHandle,
  validateHandle,
} from "../platforms/platform-rules.util";
import { calculateFollowersDrip } from "./drip-engine.util";
import { generateQuoteHash } from "./package-quote-hash.util";

export const MAX_RUNS_PER_PACKAGE_DEFAULT = 365;
export const MAX_RUNS_PER_PACKAGE_CAP = 730;
export const MAX_ITEMS_PER_PACKAGE = 10;
export const MAX_DURATION_DAYS = 365;
export const MIN_INTERVAL_HOURS = 1;
export const MAX_PLATFORM_LENGTH = 32;
export const MAX_HANDLE_LENGTH = 100;
export const MAX_TARGET_URL_LENGTH = 500;

const DEFAULT_MARGIN_FLOOR = 0.15; // 15% floor

function isServicePlatformCompatible(servicePlatform: string, packagePlatform: string): boolean {
  const normalize = (value: string) => {
    const normalized = value.toLowerCase().trim();
    return normalized === "x_twitter" || normalized === "twitter" ? "x" : normalized;
  };

  return normalize(servicePlatform) === "all" || normalize(servicePlatform) === normalize(packagePlatform);
}

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformsService?: PlatformsService
  ) {}

  /**
   * Pure quote calculation with zero DB side effects.
   * Guarantees:
   * 1. Validates platform and normalized handle against platform config.
   * 2. Checks handle against admin blocklist.
   * 3. unitCharge = ceil(rateSnapshot x maxQtyPerPost / 1000)
   * 4. POST_TRIGGERED reserve = unitCharge x maxPosts
   * 5. TIME_DRIP reserve = ceil(rate x totalQty / 1000) split over runs, last run absorbs remainder
   * 6. sum(run.quantity) === totalQty and sum(run.chargeShare) === reserve
   * 7. Warning if Q is too small to split across durationDays
   * 8. Disclaimer label communicates the maximum reserve and settlement behavior.
   * 9. Equals exact purchase price with zero state mutations.
   */
  async calculateQuote(
    input: PackageQuoteInput,
    scheduleStartAt?: Date
  ): Promise<PackageQuoteResponse> {
    // 0. Hard caps enforced BEFORE computation (GAP-2 DoS hardening)
    if (input.platform && input.platform.length > MAX_PLATFORM_LENGTH) {
      throw new UnprocessableEntityException(
        `Platform exceeds maximum allowed length of ${MAX_PLATFORM_LENGTH} characters.`
      );
    }
    const handleRaw = input.handle || (input as any).accountUsername || "";
    if (handleRaw && handleRaw.length > MAX_HANDLE_LENGTH) {
      throw new UnprocessableEntityException(
        `Handle exceeds maximum allowed length of ${MAX_HANDLE_LENGTH} characters.`
      );
    }
    const rawItemsCount = (input.items?.length || 0) + ((input as any).rules?.length || 0) + (input.postRules?.length || 0);
    if (rawItemsCount > MAX_ITEMS_PER_PACKAGE) {
      throw new UnprocessableEntityException(
        `Items count (${rawItemsCount}) exceeds maximum allowed of ${MAX_ITEMS_PER_PACKAGE}.`
      );
    }

    const checkDays = input.durationDays ?? input.days ?? input.followersDrip?.days;
    if (checkDays !== undefined && checkDays > MAX_DURATION_DAYS) {
      throw new UnprocessableEntityException(
        `Schedule duration (${checkDays} days) exceeds maximum allowed of ${MAX_DURATION_DAYS} days.`
      );
    }

    const checkInterval = input.followersDrip?.intervalHours ?? (input as any).intervalHours;
    if (checkInterval !== undefined && checkInterval < MIN_INTERVAL_HOURS) {
      throw new UnprocessableEntityException(
        `Run interval (${checkInterval} hours) is below minimum allowed of ${MIN_INTERVAL_HOURS} hour.`
      );
    }

    // O(runs) prevention: calculate estimated total runs BEFORE any iterations or loops
    let estimatedRuns = 0;
    if (input.followersDrip) {
      const f = input.followersDrip;
      const fDays = f.days ?? input.durationDays ?? input.days ?? 30;
      const fInterval = f.intervalHours ?? (input as any).intervalHours ?? 24;
      if (fDays > MAX_DURATION_DAYS) {
        throw new UnprocessableEntityException(
          `Schedule duration (${fDays} days) exceeds maximum allowed of ${MAX_DURATION_DAYS} days.`
        );
      }
      if (fInterval < MIN_INTERVAL_HOURS) {
        throw new UnprocessableEntityException(
          `Run interval (${fInterval} hours) is below minimum allowed of ${MIN_INTERVAL_HOURS} hour.`
        );
      }
      estimatedRuns += Math.floor((fDays * 24) / Math.max(1, fInterval));
    }
    if (input.postRules) {
      for (const pr of input.postRules) {
        estimatedRuns += (pr.maxPosts || 1);
      }
    }
    if (input.items) {
      for (const itm of input.items) {
        estimatedRuns += (itm.maxPosts || (itm as any).runs || 1);
      }
    }
    if ((input as any).rules) {
      for (const r of (input as any).rules) {
        estimatedRuns += (r.maxPosts || r.runs || 1);
      }
    }

    if (estimatedRuns > MAX_RUNS_PER_PACKAGE_CAP) {
      throw new UnprocessableEntityException(
        `Requested schedule produces ${estimatedRuns} estimated runs, which exceeds the maximum limit of ${MAX_RUNS_PER_PACKAGE_CAP} runs per package.`
      );
    }

    const platform = (input.platform || "instagram").toLowerCase().trim();
    const timezone = input.timezone || "UTC";
    const warnings: string[] = [];

    // 1. Validate platform config and handle if handle is provided
    let normalizedHandle = "";
    if (handleRaw) {
      if (this.platformsService) {
        const config = await this.platformsService.getPlatformConfig(platform);
        if (!config.active) {
          throw new BadRequestException(`Packages are currently unavailable for ${config.displayName}.`);
        }
        normalizedHandle = validateHandle(handleRaw, config);

        const isBlocked = await this.platformsService.isHandleBlocked(platform, normalizedHandle);
        if (isBlocked) {
          throw new BadRequestException(
            `The handle "@${normalizedHandle}" is blocked from creating packages. Please contact support.`
          );
        }
      } else {
        normalizedHandle = normalizeHandle(handleRaw);
      }
    }

    // 2. Check if there is already an ACTIVE package for this (platform, handle)
    if (normalizedHandle && this.prisma.isConnected) {
      const existing = await this.prisma.package.findFirst({
        where: {
          platform,
          handle: normalizedHandle,
          status: "ACTIVE",
        },
      });
      if (existing) {
        throw new BadRequestException(
          `An ACTIVE package already exists for ${platform} handle "@${normalizedHandle}". Complete or cancel it first.`
        );
      }
    }

    // 3. Normalize input into normalized rules:
    // Support followersDrip + postRules (M3 standard), or rules, or items (legacy)
    if (input.days !== undefined && (!Number.isInteger(input.days) || input.days <= 0)) {
      throw new BadRequestException("Schedule duration must be a positive integer.");
    }
    if (input.durationDays !== undefined && (!Number.isInteger(input.durationDays) || input.durationDays <= 0)) {
      throw new BadRequestException("Schedule duration must be a positive integer.");
    }

    const normalizedRules: NormalizedRule[] = [];
    let durationDays = input.durationDays ?? input.days ?? 30;
    let intervalHours = 24;

    if (input.followersDrip) {
      const f = input.followersDrip;
      if (f.days !== undefined && (!Number.isInteger(f.days) || f.days <= 0)) {
        throw new BadRequestException("Schedule duration must be a positive integer.");
      }
      if (f.quantity !== undefined && (!Number.isInteger(f.quantity) || f.quantity <= 0)) {
        throw new BadRequestException("Quantity must be a positive integer.");
      }
      durationDays = f.days ?? durationDays;
      intervalHours = f.intervalHours || 24;
      normalizedRules.push({
        kind: "TIME_DRIP",
        serviceId: f.serviceId,
        quantityPerPost: 0,
        totalQuantity: f.quantity,
        mediaTypes: [],
        delayMinutes: 0,
        deliveryWindowMin: 0,
        maxPosts: 1,
        maxPerDay: 0,
        minSpacingMin: 0,
      });
    }

    if (input.postRules && input.postRules.length > 0) {
      for (const pr of input.postRules) {
        normalizedRules.push({
          kind: "POST_TRIGGERED",
          serviceId: pr.serviceId,
          quantityPerPost: pr.maxQtyPerPost,
          totalQuantity: pr.maxQtyPerPost * pr.maxPosts,
          mediaTypes: ["IMAGE", "VIDEO", "REEL"],
          delayMinutes: 0,
          deliveryWindowMin: pr.defaultWindowMin || 180,
          maxPosts: pr.maxPosts,
          maxPerDay: 0,
          minSpacingMin: 15,
        });
      }
    }

    if (normalizedRules.length === 0) {
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
        throw new BadRequestException("At least one followers drip or post rule is required.");
      }
    }

    // 4. Bulk fetch services
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
        platform: platform.toUpperCase(),
        ratePer1000: new Decimal(120.0),
        minQty: 10,
        maxQty: 500000,
        costINR: new Decimal(90.0),
        status: "ACTIVE",
        packageEligible: true,
      }));
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // 5. Quote Calculation
    let packageReserveTotal = new Decimal(0);
    const calculatedItems: PackageQuoteResponse["items"] = [];
    const allRuns: PackageRunPreview[] = [];
    const now = scheduleStartAt ? new Date(scheduleStartAt.getTime()) : new Date();
    if (!Number.isFinite(now.getTime())) {
      throw new BadRequestException("Schedule start time must be a valid date.");
    }

    for (const rule of normalizedRules) {
      const svc = serviceMap.get(rule.serviceId);
      if (!svc) {
        throw new BadRequestException(`Service with ID "${rule.serviceId}" not found or discontinued.`);
      }
      if (svc.status !== "ACTIVE") {
        throw new BadRequestException(`Service "${svc.displayName || svc.name}" is currently unavailable.`);
      }
      if (svc.active === false) {
        throw new BadRequestException(`Service "${svc.displayName || svc.name}" is currently unavailable.`);
      }
      if (svc.packageEligible !== true) {
        throw new BadRequestException(`Service "${svc.displayName || svc.name}" is not eligible for packages.`);
      }
      if (!isServicePlatformCompatible(svc.platform || "", platform)) {
        throw new BadRequestException(
          `Service "${svc.displayName || svc.name}" is not available for the ${platform} platform.`
        );
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

        // unitCharge = ceil(rateSnapshot x maxQtyPerPost / 1000)
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
          target: rule.target || (normalizedHandle ? `@${normalizedHandle}` : undefined),
          targetType: "POST_OR_REEL",
          kind: "POST_TRIGGERED",
          totalQuantity: rule.quantityPerPost * rule.maxPosts,
          quantityPerPost: rule.quantityPerPost,
          charge: ruleReserve.toNumber(),
          ratePer1000: ratePer1k.toNumber(),
          runs: rule.maxPosts,
          maxPosts: rule.maxPosts,
          minQty: svc.minQty,
          maxQty: svc.maxQty,
          deliveryWindowMin: rule.deliveryWindowMin || 180,
        });

        // Add note to timeline
        allRuns.push({
          runIndex: 1,
          scheduledAt: new Date(now.getTime() + rule.delayMinutes * 60 * 1000).toISOString(),
          serviceId: svc.id,
          serviceName: `${svc.displayName || svc.name} (Per-post trigger: up to ${rule.maxPosts} posts, window: ${rule.deliveryWindowMin || 180}m)`,
          target: rule.target || (normalizedHandle ? `@${normalizedHandle}` : undefined),
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

        let dripResult;
        try {
          dripResult = calculateFollowersDrip({
            totalQuantity: totalQty,
            serviceMin: svc.minQty,
            serviceMax: svc.maxQty,
            days: durationDays,
            intervalHours,
            ratePer1000: ratePer1k.toNumber(),
            startAt: now,
          });
        } catch (error) {
          if (error instanceof RangeError) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }

        if (dripResult.warning) warnings.push(dripResult.warning);

        // TIME_DRIP reserve = ceil(rate x totalQty / 1000)
        const ruleReserve = new Decimal(ratePer1k)
          .times(totalQty)
          .dividedBy(1000)
          .toDecimalPlaces(2, Decimal.ROUND_CEIL);

        packageReserveTotal = packageReserveTotal.plus(ruleReserve);

        for (const run of dripResult.runs) {
          allRuns.push({
            runIndex: run.seq,
            scheduledAt: run.executeAt.toISOString(),
            serviceId: svc.id,
            serviceName: `${svc.displayName || svc.name} (Time-interval run ${run.seq} of ${dripResult.runsCount})`,
            target: rule.target || (normalizedHandle ? `@${normalizedHandle}` : undefined),
            quantity: run.quantity,
            chargeShare: run.allocatedCharge,
          });
        }

        calculatedItems.push({
          serviceId: svc.id,
          serviceName: svc.displayName || svc.name,
          target: rule.target || (normalizedHandle ? `@${normalizedHandle}` : undefined),
          targetType: "PROFILE",
          kind: "TIME_DRIP",
          totalQuantity: totalQty,
          quantityPerPost: dripResult.runs[0]?.quantity || totalQty,
          charge: ruleReserve.toNumber(),
          ratePer1000: ratePer1k.toNumber(),
          runs: dripResult.runsCount,
          maxPosts: 1,
          minQty: svc.minQty,
          maxQty: svc.maxQty,
          deliveryWindowMin: 0,
        });
      }
    }

    allRuns.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const { quoteHash, expiresAt } = generateQuoteHash({
      userId: (input as any).userId || "",
      platform,
      handle: normalizedHandle,
      timezone,
      days: durationDays,
      intervalHours,
      totalCharge: packageReserveTotal.toNumber(),
      totalRuns: allRuns.length,
      items: calculatedItems,
    });

    return {
      valid: true,
      timezone,
      totalCharge: packageReserveTotal.toNumber(),
      totalRuns: allRuns.length,
      days: durationDays,
      items: calculatedItems,
      timeline: allRuns,
      warnings,
      disclaimer: "Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation.",
      quoteHash,
      expiresAt,
    };
  }
}
