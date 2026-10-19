import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ServicesModule } from "./modules/services/services.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { WalletModule } from "./modules/wallet/wallet.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { UsersModule } from "./modules/users/users.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { CouponsModule } from "./modules/coupons/coupons.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { ResellerModule } from "./modules/reseller/reseller.module";
import { EmailModule } from "./modules/email/email.module";
import { PricingModule } from "./modules/pricing/pricing.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { PackagesModule } from "./modules/packages/packages.module";
import { RequestIdMiddleware } from "./common/request-id.middleware";
import { RateLimiterMiddleware } from "./common/rate-limiter.middleware";

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
    PaymentsModule,
    CouponsModule,
    NotificationsModule,
    AnnouncementsModule,
    SettingsModule,
    ReportsModule,
    ResellerModule,
    EmailModule,
    PricingModule,
    FavoritesModule,
    PackagesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RateLimiterMiddleware).forRoutes("*");
  }
}
