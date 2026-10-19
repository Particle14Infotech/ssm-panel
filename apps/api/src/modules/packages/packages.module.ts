import { Module } from "@nestjs/common";
import { PackagesService } from "./packages.service";
import { PackagesQuoteService } from "./packages-quote.service";
import { PackagesSchedulerService } from "./packages-scheduler.service";
import { PackagesController } from "./packages.controller";
import { PrismaService } from "../../common/prisma.service";

@Module({
  controllers: [PackagesController],
  providers: [
    PackagesService,
    PackagesQuoteService,
    PackagesSchedulerService,
    PrismaService,
  ],
  exports: [PackagesService, PackagesQuoteService, PackagesSchedulerService],
})
export class PackagesModule {}
