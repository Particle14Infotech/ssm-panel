import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { ServicesModule } from "../services/services.module";
import { WalletModule } from "../wallet/wallet.module";
import { SettingsModule } from "../settings/settings.module";
import { PrismaService } from "../../common/prisma.service";

import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [ServicesModule, WalletModule, SettingsModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
