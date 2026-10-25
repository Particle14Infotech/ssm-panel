import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ProvidersService } from "./providers.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("Provider Node Sync")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  @ApiOperation({ summary: "Get Upstream Wholesalers with Masked Keys" })
  findAll() {
    return this.providersService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Connect and Encrypt Upstream Wholesaler (Canonical)" })
  createCanonical(@Body() body: { name: string; apiUrl: string; apiKey: string }) {
    return this.providersService.create(body);
  }

  @Post("create")
  @ApiOperation({ summary: "Connect and Encrypt Upstream Wholesaler (Legacy)" })
  create(@Body() body: { name: string; apiUrl: string; apiKey: string }) {
    return this.providersService.create(body);
  }

  @Get(":id")
  @ApiOperation({ summary: "Inspect Specific Upstream Provider" })
  findOne(@Param("id") id: string) {
    return this.providersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Admin Update Upstream Provider" })
  update(@Param("id") id: string, @Body() body: any) {
    return this.providersService.update(id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Admin Delete Upstream Provider" })
  remove(@Param("id") id: string) {
    return this.providersService.remove(id);
  }

  @Get(":id/balance")
  @ApiOperation({ summary: "Fetch Live Upstream Provider Balance" })
  getBalance(@Param("id") id: string) {
    return this.providersService.getBalance(id);
  }

  @Post(":id/sync")
  @ApiOperation({ summary: "Trigger Upstream Provider Sync & Balance Fetch" })
  sync(@Param("id") id: string) {
    return this.providersService.sync(id);
  }

  @Post(":id/import")
  @ApiOperation({ summary: "Import services from upstream provider with margin" })
  importServices(@Param("id") id: string, @Body() body: { marginPercent?: number }) {
    return this.providersService.importServices(id, body || {});
  }

  @Put("services/:serviceId/managed-drip")
  @ApiOperation({ summary: "Toggle Managed Drip-Feed for a specific service" })
  setManagedDrip(@Param("serviceId") serviceId: string, @Body() body: { allow: boolean }) {
    return this.providersService.setAllowManagedDrip(serviceId, Boolean(body.allow));
  }

  @Put("categories/:categoryId/managed-drip")
  @ApiOperation({ summary: "Bulk toggle Managed Drip-Feed for all services in a category" })
  bulkSetManagedDripByCategory(@Param("categoryId") categoryId: string, @Body() body: { allow: boolean }) {
    return this.providersService.bulkSetAllowManagedDripByCategory(categoryId, Boolean(body.allow));
  }
}
