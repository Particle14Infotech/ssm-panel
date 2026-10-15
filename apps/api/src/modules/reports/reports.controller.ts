import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";

@ApiTags("Reports & Analytics")
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
