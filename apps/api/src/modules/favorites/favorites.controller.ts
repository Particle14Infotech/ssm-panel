import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { FavoritesService } from "./favorites.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { CreateFavoriteInputSchema } from "@smm/contracts";

@ApiTags("Customer Favorites")
@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List User Favorites" })
  async listFavorites(@CurrentUser() user: CurrentUserData) {
    return this.favoritesService.listFavorites(user.id);
  }

  @Post()
  @ApiOperation({ summary: "Add or Update a Favorite" })
  async createFavorite(
    @CurrentUser() user: CurrentUserData,
    @Body() body: any
  ) {
    if (body.config) {
      return this.favoritesService.createFavoriteWithConfig(user.id, body);
    }
    const parseRes = CreateFavoriteInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid input";
      throw new BadRequestException(err);
    }
    return this.favoritesService.createFavorite(user.id, parseRes.data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a Favorite" })
  async deleteFavorite(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.favoritesService.deleteFavorite(user.id, id);
  }

  @Get("suggestions")
  @ApiOperation({ summary: "Get Smart Suggestions from Recent Orders" })
  async getSuggestions(@CurrentUser() user: CurrentUserData) {
    return this.favoritesService.getSuggestions(user.id);
  }

  @Post("suggestions/dismiss")
  @ApiOperation({ summary: "Dismiss a Smart Suggestion" })
  async dismissSuggestion(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { serviceId: string; targetUrl: string }
  ) {
    if (!body?.serviceId || !body?.targetUrl) {
      throw new BadRequestException("serviceId and targetUrl are required.");
    }
    return this.favoritesService.dismissSuggestion(user.id, body.serviceId, body.targetUrl);
  }
}
