import { Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { FeatureFlagsService } from "./flags.service";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, FeatureFlagsService, PrismaService, SMMCacheService],
  exports: [SettingsService, FeatureFlagsService],
})
export class SettingsModule {}
