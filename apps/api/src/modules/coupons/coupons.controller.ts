import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CouponsService } from "./coupons.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Create Bonus Incentive Tier" })
  createBonus(@Body() body: { minAmount: number; bonusPct: number }) {
    return this.couponsService.createBonus(body);
  }
}
