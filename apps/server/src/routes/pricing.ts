import { FastifyInstance } from "fastify";
import { PricingService } from "../services/pricing.service";
import { calculateSellingRate, calculateOrderFinancialSnapshot } from "@smm/contracts";

export function registerPricingRoutes(app: FastifyInstance, pricingService: PricingService) {
  const adminGuard = [app.authenticate, app.authorize("ADMIN")];

  app.get("/api/v1/admin/pricing/settings", { preHandler: adminGuard }, async () => {
    return pricingService.getSettings();
  });

  app.put("/api/v1/admin/pricing/settings", { preHandler: adminGuard }, async (request) => {
    const body = (request.body as any) || {};
    return pricingService.updateSettings(body);
  });

  app.post("/api/v1/admin/pricing/what-if", { preHandler: adminGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const settings = await pricingService.getSettings();
    const qty = body.quantity || 1000;

    const pricing = calculateSellingRate(body.costINR, {
      settings,
      marginPercentOverride: body.marginOverride,
      fixedSellingRateOverride: body.fixedSellingRate,
    });

    const snapshot = calculateOrderFinancialSnapshot(
      pricing.sellingRate,
      body.costINR,
      qty,
      1,
      0,
      settings.paymentFeePercent
    );

    return reply.status(201).send({
      costINR: body.costINR,
      quantity: qty,
      sellingRatePer1k: pricing.sellingRate.toNumber(),
      appliedMarginPercent: pricing.appliedMarginPercent,
      isBelowCost: pricing.isBelowCost,
      warning: pricing.warning,
      customerCharge: snapshot.customerCharge.toNumber(),
      estimatedProviderCost: snapshot.estimatedProviderCost.toNumber(),
      estimatedGrossProfit: snapshot.estimatedGrossProfit.toNumber(),
      paymentFeeEstimate: snapshot.paymentFeeEstimate.toNumber(),
      estimatedNetProfit: snapshot.estimatedNetProfit.toNumber(),
      netMarginPercent: snapshot.netMarginPercent,
    });
  });

  app.get("/api/v1/admin/pricing/pending", { preHandler: adminGuard }, async () => {
    return pricingService.getPendingPriceChanges();
  });

  app.post("/api/v1/admin/pricing/pending/:id/approve", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return pricingService.approvePendingPriceChange(id);
  });

  app.post("/api/v1/admin/pricing/pending/:id/reject", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return pricingService.rejectPendingPriceChange(id);
  });

  app.post("/api/v1/admin/pricing/bulk-margin", { preHandler: adminGuard }, async (request) => {
    const body = (request.body as any) || {};
    return pricingService.previewOrApplyBulkMargin(body);
  });

  app.post("/api/v1/admin/pricing/backfill-costs", { preHandler: adminGuard }, async () => {
    return pricingService.backfillMissingCosts();
  });

  app.get("/api/v1/admin/profit/summary", { preHandler: adminGuard }, async (request) => {
    const query = (request.query as any) || {};
    return pricingService.getProfitSummary(
      query.startDate,
      query.endDate,
      query.dripFeedOnly === "true" || query.dripFeedOnly === "1"
    );
  });
}
