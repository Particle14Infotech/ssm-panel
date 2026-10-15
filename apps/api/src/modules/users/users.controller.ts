import { Controller, Get, Post, Put, Delete, Body, Param, Headers } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";

@ApiTags("User Management")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get Current Authenticated Profile" })
  getProfile(@Headers("x-user-id") headerUserId?: string) {
    return this.usersService.getProfile(headerUserId);
  }

  @Put("me")
  @ApiOperation({ summary: "Update Current Profile & Settings" })
  updateProfile(@Body() body: any, @Headers("x-user-id") headerUserId?: string) {
    return this.usersService.updateProfile(headerUserId || "", body);
  }

  @Get()
  @ApiOperation({ summary: "Admin List All Users" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Admin Inspect User Detail" })
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Admin Update User" })
  update(@Param("id") id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Admin Soft-Delete User" })
  remove(@Param("id") id: string) {
    return this.usersService.remove(id);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Admin Update User Role/Tier Status" })
  updateStatus(@Param("id") id: string, @Body() body: any) {
    return this.usersService.updateStatus(id, body);
  }

  @Post(":id/reset-password")
  @ApiOperation({ summary: "Admin Reset User Password" })
  resetPassword(@Param("id") id: string, @Body() body: any) {
    return this.usersService.adminResetPassword(id, body);
  }
}
