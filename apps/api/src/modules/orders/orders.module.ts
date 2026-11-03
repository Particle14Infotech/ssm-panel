import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { NewOrderBootstrapController } from "./new-order-bootstrap.controller";
import { OrdersService } from "./orders.service";
import { ServicesModule } from "../services/services.module";
import { WalletModule } from "../wallet/wallet.module";
import { SettingsModule } from "../settings/settings.module";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [ServicesModule, WalletModule, SettingsModule, PricingModule],
  controllers: [OrdersController, NewOrderBootstrapController],
  providers: [OrdersService, PrismaService, SMMCacheService],
  exports: [OrdersService],
})
export class OrdersModule {}
