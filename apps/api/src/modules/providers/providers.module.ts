import { Module } from "@nestjs/common";
import { ProvidersController } from "./providers.controller";
import { ProvidersService } from "./providers.service";
import { SmmProviderClient } from "./smm-provider.client";
import { PrismaService } from "../../common/prisma.service";

@Module({
  controllers: [ProvidersController],
  providers: [ProvidersService, SmmProviderClient, PrismaService],
  exports: [ProvidersService, SmmProviderClient],
})
export class ProvidersModule {}
