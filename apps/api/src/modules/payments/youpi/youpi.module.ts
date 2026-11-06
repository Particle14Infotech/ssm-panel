import { Module } from "@nestjs/common";
import { YoupiService } from "./youpi.service";
import { YoupiGatewayProvider } from "./youpi-gateway.provider";
import { YoupiController } from "./youpi.controller";
import { PrismaService } from "../../../common/prisma.service";
import { WalletModule } from "../../wallet/wallet.module";

@Module({
  imports: [WalletModule],
  controllers: [YoupiController],
  providers: [YoupiService, YoupiGatewayProvider, PrismaService],
  exports: [YoupiService, YoupiGatewayProvider]
})
export class YoupiModule {}

