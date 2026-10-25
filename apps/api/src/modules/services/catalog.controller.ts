import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ServicesService } from "./services.service";

@ApiTags("Catalog")
@Controller("catalog")
export class CatalogController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get("grouped")
  @ApiOperation({ summary: "Get Grouped Catalog by Category (Single Query)" })
  @ApiQuery({ name: "platform", required: false })
  getGrouped(@Query("platform") platform?: string) {
    return this.servicesService.getGroupedCatalog(platform);
  }
}
