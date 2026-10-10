import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ServicesService } from "./services.service";

@ApiTags("Services Catalog")
@Controller("services")
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: "Get All Active Services" })
  @ApiQuery({ name: "platform", required: false })
  findAll(@Query("platform") platform?: string) {
    return this.servicesService.findAll(platform);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Service by ID" })
  findOne(@Param("id") id: string) {
    const service = this.servicesService.findOne(id);
    if (!service) throw new NotFoundException(`Service #${id} not found.`);
    return service;
  }
}
