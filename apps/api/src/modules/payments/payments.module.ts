import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SimulatedPaymentProvider } from "./simulated-payment.provider";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";
import { PrismaService } from "../../common/prisma.service";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [WalletModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    SimulatedPaymentProvider,
    RazorpayPaymentProvider,
    PrismaService,
  ],
  exports: [PaymentsService, SimulatedPaymentProvider, RazorpayPaymentProvider],
})
export class PaymentsModule {}
