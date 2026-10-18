import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EmailController } from "./email.controller";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";

@Module({
  controllers: [EmailController],
  providers: [EmailService, PrismaService, SMMCacheService],
  exports: [EmailService],
})
export class EmailModule {}
