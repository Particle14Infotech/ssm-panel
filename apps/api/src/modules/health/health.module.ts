import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaService, SMMCacheService],
})
export class HealthModule {}
