import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ServicesModule } from "../services/services.module";
import { WalletModule } from "../wallet/wallet.module";
import { PrismaService } from "../../common/prisma.service";

@Module({
  imports: [ServicesModule, WalletModule],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
