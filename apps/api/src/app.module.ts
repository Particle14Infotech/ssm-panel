import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ServicesModule } from "./modules/services/services.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { UsersModule } from "./modules/users/users.module";
import { TicketsModule } from "./modules/tickets/tickets.module";

@Module({
  imports: [
    HealthModule,
    AuthModule,
    ServicesModule,
    OrdersModule,
    WalletModule,
    ProvidersModule,
    UsersModule,
    TicketsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
