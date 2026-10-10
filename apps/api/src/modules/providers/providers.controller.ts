import { Controller, Get, Post, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Provider Node Sync")
@Controller("providers")
export class ProvidersController {
  @Get()
  @ApiOperation({ summary: "Get Upstream Wholesalers" })
  findAll() {
    return [
      {
        id: "prov_smm_main",
        name: "ApexSMM Global API",
        balance: 4820.5,
        currency: "USD",
        status: "CONNECTED",
        serviceCount: 420,
      },
      {
        id: "prov_speed_router",
        name: "HyperRoute High-Speed Provider",
        balance: 1980.25,
        currency: "USD",
        status: "CONNECTED",
        serviceCount: 154,
      },
    ];
  }

  @Post(":id/sync")
  @ApiOperation({ summary: "Trigger Upstream Provider Sync" })
  sync(@Param("id") id: string) {
    return {
      success: true,
      providerId: id,
      syncedServices: 420,
      latencyMs: 14.2,
      timestamp: new Date().toISOString(),
    };
  }
}
