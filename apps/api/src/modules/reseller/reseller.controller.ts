import { Controller, Get, Post, Put, Body, Param, Headers, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { ResellerService } from "./reseller.service";
import { ApiKeyAuthGuard } from "../../common/api-key-auth.guard";

@ApiTags("Reseller Portal & API")
@Controller("reseller")
export class ResellerController {
  constructor(private readonly resellerService: ResellerService) {}

  @Get("reports")
  @ApiOperation({ summary: "Get Reseller Performance Reports" })
  getReports() {
    return this.resellerService.getReports();
  }

  @Get("clients")
  @ApiOperation({ summary: "Get Downstream Reseller Clients" })
  getClients() {
    return this.resellerService.getClients();
  }

  @Get("pricing")
  @ApiOperation({ summary: "Get Wholesale Tiered Pricing Matrix" })
  async getPricing() {
    return await this.resellerService.getPricing();
  }

  @Put("pricing")
  @ApiOperation({ summary: "Set Custom Reseller Margin Pricing" })
  updatePricing(@Body() body: { serviceId: string; customRate: number }) {
    return this.resellerService.updatePricing(body);
  }

  @Post("api-key/rotate")
  @ApiOperation({ summary: "Rotate Wholesale API Key" })
  rotateApiKey(@Headers("x-user-id") userId?: string) {
    return this.resellerService.rotateApiKey(userId);
  }

  @Get("v1/services")
  @ApiSecurity("reseller-api-key")
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Public Reseller v1 Services Catalog" })
  async getPublicServices() {
    return await this.resellerService.getPublicServices();
  }

  @Post("v1/orders")
  @ApiSecurity("reseller-api-key")
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Public Reseller v1 Place Order" })
  createPublicOrder(@Body() body: { service: string; link: string; quantity: number }) {
    return this.resellerService.createPublicOrder(body);
  }

  @Get("v1/orders/:id")
  @ApiSecurity("reseller-api-key")
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Public Reseller v1 Order Status" })
  getPublicOrderStatus(@Param("id") id: string) {
    return this.resellerService.getPublicOrderStatus(id);
  }

  @Get("v1/balance")
  @ApiSecurity("reseller-api-key")
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Public Reseller v1 Account Balance" })
  getPublicBalance() {
    return this.resellerService.getPublicBalance();
  }
}
