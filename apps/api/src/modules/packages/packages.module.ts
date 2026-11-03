import { Module } from "@nestjs/common";
import { PackagesService } from "./packages.service";
import { PackagesQuoteService } from "./packages-quote.service";
import { PackagesSchedulerService } from "./packages-scheduler.service";
import { PackagesController } from "./packages.controller";
import { PackageTemplatesAdminController } from "./package-templates-admin.controller";
import { PackagesEnabledGuard } from "./packages-enabled.guard";
import { PrismaService } from "../../common/prisma.service";
import { PlatformsModule } from "../platforms/platforms.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [PlatformsModule, SettingsModule],
  controllers: [PackagesController, PackageTemplatesAdminController],
  providers: [
    PackagesService,
    PackagesQuoteService,
    PackagesSchedulerService,
    PackagesEnabledGuard,
    PrismaService,
  ],
  exports: [PackagesService, PackagesQuoteService, PackagesSchedulerService],
})
export class PackagesModule {}
