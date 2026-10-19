import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PackageQuoteInput, PackageQuoteResponse, PackageRunPreview } from "@smm/contracts";
import { Decimal } from "decimal.js";

@Injectable()
export class PackagesQuoteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a deterministic run schedule & pricing quote for a package.
   * Guarantees:
   * 1. Quantity Invariant: sum(run.quantity) === item.totalQuantity for every item.
   * 2. Financial Invariant: sum(run.chargeShare) === item.charge and sum(item.charge) === totalCharge.
   * 3. Provider Limits: every run quantity satisfies minQty <= qty <= maxQty.
   */
  async calculateQuote(input: PackageQuoteInput): Promise<PackageQuoteResponse> {
    const days = input.days;
    const intervalHours = input.intervalHours || 24;
    const warnings: string[] = [];

    // 1. Fetch all requested services
    const serviceIds = [...new Set(input.items.map((i) => i.serviceId))];
    let services: any[] = [];

    if (this.prisma.isConnected) {
      services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, isDeleted: false },
      });
    } else {
      // Sandbox fallback mocks
      services = serviceIds.map((id) => ({
        id,
        name: `Service #${id}`,
        displayName: `Service #${id}`,
        platform: "INSTAGRAM",
        ratePer1000: new Decimal(120.0),
        minQty: 10,
        maxQty: 500000,
        status: "ACTIVE",
      }));
    }

    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // 2. Validate services existence and constraints
    for (const item of input.items) {
      const svc = serviceMap.get(item.serviceId);
      if (!svc) {
        throw new BadRequestException(`Service with ID "${item.serviceId}" not found or discontinued.`);
      }
      if (svc.status !== "ACTIVE") {
        throw new BadRequestException(`Service "${svc.displayName || svc.name}" is currently unavailable.`);
      }

      // Quantity per run validation
      const baseQtyPerRun = Math.floor(item.quantity / days);
      if (baseQtyPerRun < svc.minQty) {
        throw new BadRequestException(
          `Quantity (${item.quantity}) is too low for ${days} days on "${svc.displayName || svc.name}". Minimum quantity per run is ${svc.minQty}. Increase total quantity to at least ${svc.minQty * days} or reduce duration to ${Math.floor(item.quantity / svc.minQty)} days.`
        );
      }
      const maxQtyPerRun = baseQtyPerRun + (item.quantity % days > 0 ? 1 : 0);
      if (maxQtyPerRun > svc.maxQty) {
        throw new BadRequestException(
          `Quantity per run exceeds maximum limit of ${svc.maxQty} on "${svc.displayName || svc.name}".`
        );
      }

      // Target link type advisory warning
      if (item.targetType === "PROFILE" && (item.target.includes("/p/") || item.target.includes("/reel/"))) {
        warnings.push(`Item "${svc.displayName || svc.name}" is configured for profile delivery, but the target looks like a post link.`);
      } else if (item.targetType === "POST_OR_REEL" && !item.target.includes("/") && !item.target.startsWith("http")) {
        warnings.push(`Item "${svc.displayName || svc.name}" is configured for post/reel engagement, but the target looks like a handle.`);
      }
    }

    // 3. Calculate Item Breakdown and Run Allocations
    let packageTotalCharge = new Decimal(0);
    const calculatedItems: PackageQuoteResponse["items"] = [];
    const allRuns: PackageRunPreview[] = [];
    const now = new Date();

    for (let itemIdx = 0; itemIdx < input.items.length; itemIdx++) {
      const item = input.items[itemIdx];
      const svc = serviceMap.get(item.serviceId)!;

      // Rate calculation (Decimal arithmetic for financial precision)
      const ratePer1k = new Decimal(svc.ratePer1000.toString());
      const itemCharge = new Decimal(item.quantity)
        .times(ratePer1k)
        .dividedBy(1000)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      packageTotalCharge = packageTotalCharge.plus(itemCharge);

      // Distribute quantities across runs
      const baseQty = Math.floor(item.quantity / days);
      const remainderQty = item.quantity % days;

      // Distribute charge across runs
      const runQuantities: number[] = [];
      for (let r = 0; r < days; r++) {
        // Distribute remainder 1 by 1 across initial runs
        const runQty = r < remainderQty ? baseQty + 1 : baseQty;
        runQuantities.push(runQty);
      }

      // Distribute cents exactly so sum(chargeShare) === itemCharge
      const runChargeShares: Decimal[] = [];
      let distributedCharge = new Decimal(0);

      for (let r = 0; r < days; r++) {
        if (r === days - 1) {
          // Final run absorbs rounding remainder to guarantee exact cents reconciliation
          const finalShare = itemCharge.minus(distributedCharge);
          runChargeShares.push(finalShare);
        } else {
          const share = new Decimal(runQuantities[r])
            .times(ratePer1k)
            .dividedBy(1000)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          runChargeShares.push(share);
          distributedCharge = distributedCharge.plus(share);
        }
      }

      // Generate timeline runs
      for (let r = 0; r < days; r++) {
        const scheduledTime = new Date(now.getTime() + r * intervalHours * 3600 * 1000);
        allRuns.push({
          runIndex: r + 1,
          scheduledAt: scheduledTime.toISOString(),
          serviceId: svc.id,
          serviceName: svc.displayName || svc.name,
          target: item.target,
          quantity: runQuantities[r],
          chargeShare: runChargeShares[r].toNumber(),
        });
      }

      calculatedItems.push({
        serviceId: svc.id,
        serviceName: svc.displayName || svc.name,
        target: item.target,
        targetType: item.targetType,
        totalQuantity: item.quantity,
        charge: itemCharge.toNumber(),
        ratePer1000: ratePer1k.toNumber(),
        runs: days,
        minQty: svc.minQty,
        maxQty: svc.maxQty,
      });
    }

    // Sort all runs chronologically
    allRuns.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    return {
      valid: true,
      totalCharge: packageTotalCharge.toNumber(),
      totalRuns: allRuns.length,
      days,
      items: calculatedItems,
      timeline: allRuns,
      warnings,
    };
  }
}
