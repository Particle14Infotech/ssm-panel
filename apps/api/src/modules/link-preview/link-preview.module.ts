import { Module } from "@nestjs/common";
import { LinkPreviewController } from "./link-preview.controller";
import { LinkPreviewService } from "./link-preview.service";
import { SettingsModule } from "../settings/settings.module";
import { SMMCacheService } from "../../common/cache.service";
import { PrismaService } from "../../common/prisma.service";

@Module({
  imports: [SettingsModule],
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService, SMMCacheService, PrismaService],
  exports: [LinkPreviewService],
})
export class LinkPreviewModule {}

