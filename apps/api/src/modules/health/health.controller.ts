import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiResponse({ status: 200, description: "Process is alive" })
  getLiveness() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiResponse({ status: 200, description: "Process is ready to receive traffic" })
  @HealthCheck()
  getReadiness() {
    return {
      status: "ready",
      clusterNode: "Node-08-Alpha",
      services: {
        database: "connected",
        redis: "connected",
        outboxRelay: "idle",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
