import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ServicesService } from "./services.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("Services Catalog")
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get("platforms")
  @ApiOperation({ summary: "Get Supported Social Media Platforms" })
  getPlatforms() {
    return this.servicesService.getPlatforms();
  }

  @Get("categories")
  @ApiOperation({ summary: "Get Catalog Categories" })
  getCategories() {
    return this.servicesService.getCategories();
  }

  @Get("grouped")
  @ApiOperation({ summary: "Get Grouped Catalog by Category" })
  @ApiQuery({ name: "platform", required: false })
  getGrouped(@Query("platform") platform?: string) {
    return this.servicesService.getGroupedCatalog(platform);
  }

  @Post("categories")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Create Category" })
  createCategory(@Body() body: { name: string; slug?: string }) {
    return this.servicesService.createCategory(body);
  }

  @Get()
  @ApiOperation({ summary: "Get All Active Services with Search/Filter/Sort" })
  @ApiQuery({ name: "platform", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "categoryId", required: false })
  @ApiQuery({ name: "sortBy", required: false })
  @ApiQuery({ name: "packageEligible", required: false })
  findAll(
    @Query("platform") platform?: string,
    @Query("q") query?: string,
    @Query("categoryId") categoryId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("packageEligible") packageEligible?: string
  ) {
    return this.servicesService.findAll(platform, query, categoryId, sortBy, packageEligible);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Service by ID" })
  findOne(@Param("id") id: string) {
    const service = this.servicesService.findOne(id);
    if (!service) throw new NotFoundException(`Service #${id} not found.`);
    return service;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Create Service" })
  create(@Body() body: any) {
    return this.servicesService.create(body);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update Service" })
  update(@Param("id") id: string, @Body() body: any) {
    const res = this.servicesService.update(id, body);
    if (!res) throw new NotFoundException(`Service #${id} not found.`);
    return res;
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Delete Service" })
  remove(@Param("id") id: string) {
    const deleted = this.servicesService.remove(id);
    if (!deleted) throw new NotFoundException(`Service #${id} not found.`);
    return { success: true, message: `Service #${id} removed.` };
  }
}
