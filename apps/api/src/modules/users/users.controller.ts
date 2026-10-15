import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { Role } from "@prisma/client";

@ApiTags("User Management")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Current Authenticated Profile" })
  getProfile(
    @CurrentUser() user?: CurrentUserData | string,
    @Headers("x-user-id") headerUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || headerUserId);
    return this.usersService.getProfile(effectiveUserId);
  }

  @Put("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update Current Profile & Settings" })
  updateProfile(
    @Body() body: any,
    @Headers("x-user-id") headerUserId?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    const effectiveUserId = user?.id || (typeof headerUserId === "string" ? headerUserId : "");
    return this.usersService.updateProfile(effectiveUserId, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin List All Users" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Inspect User Detail" })
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update User" })
  update(@Param("id") id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Soft-Delete User" })
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update User Role/Tier Status" })
  updateStatus(@Param("id") id: string, @Body() body: any) {
    return this.usersService.updateStatus(id, body);
  }

  @Post(":id/reset-password")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Reset User Password" })
  resetPassword(@Param("id") id: string, @Body() body: any) {
    return this.usersService.adminResetPassword(id, body);
  }
}

