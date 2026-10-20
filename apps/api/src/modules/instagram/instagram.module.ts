import { Module } from "@nestjs/common";
import { ConnectionsController, InstagramLegacyController } from "./instagram.controller";
import { InstagramService } from "./instagram.service";
import { PrismaService } from "../../common/prisma.service";

@Module({
  controllers: [ConnectionsController, InstagramLegacyController],
  providers: [InstagramService, PrismaService],
  exports: [InstagramService],
})
export class InstagramModule {}
