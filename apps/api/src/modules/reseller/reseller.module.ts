import { Module } from "@nestjs/common";
import { ResellerController } from "./reseller.controller";
import { ResellerService } from "./reseller.service";
import { ServicesModule } from "../services/services.module";
import { OrdersModule } from "../orders/orders.module";
import { WalletModule } from "../wallet/wallet.module";
import { ApiKeyAuthGuard } from "../../common/api-key-auth.guard";
import { PrismaService } from "../../common/prisma.service";

@Module({
  imports: [ServicesModule, OrdersModule, WalletModule],
  controllers: [ResellerController],
  providers: [ResellerService, ApiKeyAuthGuard, PrismaService],
  exports: [ResellerService],
})
export class ResellerModule {}

