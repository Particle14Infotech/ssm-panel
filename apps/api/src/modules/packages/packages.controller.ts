import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PackagesService } from "./packages.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { PackageQuoteInputSchema, PackagePurchaseInputSchema } from "@smm/contracts";

@ApiTags("Scheduled Packages Engine")
@Controller("packages")
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post("quote")
  @ApiOperation({ summary: "Get Price Quote and Run Allocation Preview" })
  async getQuote(@Body() body: any) {
    const parseRes = PackageQuoteInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid package configuration";
      throw new BadRequestException(err);
    }
    return this.packagesService.getQuote(parseRes.data);
  }

  @Post("purchase")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Purchase Package with Upfront Wallet Debit" })
  async purchasePackage(
    @CurrentUser() user: CurrentUserData,
    @Body() body: any
  ) {
    const parseRes = PackagePurchaseInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid package purchase data";
      throw new BadRequestException(err);
    }
    return this.packagesService.purchasePackage(user.id, parseRes.data);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List User Growth Packages" })
  async listPackages(@CurrentUser() user: CurrentUserData) {
    return this.packagesService.listPackages(user.id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Package Details and Run Timeline" })
  async getPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.getPackage(user.id, id);
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel Remaining Runs with Instant Wallet Refund" })
  async cancelPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.cancelPackage(user.id, id);
  }
}
