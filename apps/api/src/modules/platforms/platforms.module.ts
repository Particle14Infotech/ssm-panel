import { Module } from "@nestjs/common";
import { PlatformsService } from "./platforms.service";
import { PlatformsController } from "./platforms.controller";
import { PlatformsAdminController } from "./platforms-admin.controller";
import { PrismaService } from "../../common/prisma.service";

@Module({
  controllers: [PlatformsController, PlatformsAdminController],
  providers: [PlatformsService, PrismaService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
