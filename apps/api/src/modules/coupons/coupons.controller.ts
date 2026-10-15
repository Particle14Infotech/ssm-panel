import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CouponsService } from "./coupons.service";

@ApiTags("Coupons & Bonus Rules")
@Controller()
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get("coupons")
  @ApiOperation({ summary: "List Active Coupons" })
  findAll() {
    return this.couponsService.findAll();
  }

  @Post("coupons")
  @ApiOperation({ summary: "Admin Create Coupon" })
  create(@Body() body: any) {
    return this.couponsService.create(body);
  }

  @Post("coupons/apply")
  @ApiOperation({ summary: "Validate and Apply Coupon Code" })
  apply(@Body() body: { code: string; orderAmount: number }) {
    return this.couponsService.apply(body.code, Number(body.orderAmount));
  }

  @Get("bonuses")
  @ApiOperation({ summary: "List Deposit Bonus Incentive Tiers" })
  findAllBonuses() {
    return this.couponsService.findAllBonuses();
  }

  @Post("bonuses")
  @ApiOperation({ summary: "Admin Create Bonus Incentive Tier" })
  createBonus(@Body() body: { minAmount: number; bonusPct: number }) {
    return this.couponsService.createBonus(body);
  }
}
