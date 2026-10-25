import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("Reports & Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("summary")
  @ApiOperation({ summary: "Get Operational & Financial Analytics Summary" })
  async getSummary() {
    return await this.reportsService.getSummary();
  }

  @Get("export-csv")
  @ApiOperation({ summary: "Export Transactions and Orders to CSV" })
  async exportCsv() {
    return await this.reportsService.exportCsv();
  }
}
