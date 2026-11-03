import { Module } from "@nestjs/common";
import { ServicesController } from "./services.controller";
import { CatalogController } from "./catalog.controller";
import { ServicesService } from "./services.service";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";

@Module({
  controllers: [ServicesController, CatalogController],
  providers: [ServicesService, PrismaService, SMMCacheService],
  exports: [ServicesService, SMMCacheService],
})
export class ServicesModule {}
