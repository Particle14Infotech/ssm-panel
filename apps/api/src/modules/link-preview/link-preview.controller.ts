import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { LinkPreviewService } from "./link-preview.service";
import { LinkPreviewDto } from "./link-preview.interface";
import { FastifyRequest, FastifyReply } from "fastify";

@Controller("link-preview")
export class LinkPreviewController {
  constructor(private readonly linkPreviewService: LinkPreviewService) {}

  @Get()
  async getPreview(
    @Query("url") rawUrl: string,
    @Query("platform") platform: string,
    @Query("id") id: string,
    @Req() req: FastifyRequest & { user?: { id: string; role?: string } }
  ): Promise<LinkPreviewDto> {
    let targetLink = (rawUrl || "").trim();

    // If platform and id are provided, synthesize canonical target link
    if (!targetLink && platform && id) {
      const p = platform.toUpperCase();
      if (p === "YOUTUBE") targetLink = `https://www.youtube.com/watch?v=${id}`;
      else if (p === "INSTAGRAM") targetLink = `https://www.instagram.com/reel/${id}/`;
      else if (p === "TIKTOK") targetLink = `https://www.tiktok.com/@video/video/${id}`;
    }

    if (!targetLink) {
      throw new BadRequestException("Either 'url' or 'platform' and 'id' query parameters are required");
    }

    const userId = req.user?.id || "";
    const isAdmin = req.user?.role === "ADMIN";
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "127.0.0.1";

    return await this.linkPreviewService.getLinkPreview(
      targetLink,
      userId,
      clientIp,
      isAdmin
    );
  }

  @Get("proxy-image")
  async proxyImage(
    @Query("url") rawUrl: string,
    @Res() reply: any
  ): Promise<void> {
    if (!rawUrl) {
      if (typeof reply?.status === "function") {
        reply.status(400).send("Missing url parameter");
      } else if (typeof reply?.writeHead === "function") {
        reply.writeHead(400, { "Content-Type": "text/plain" });
        reply.end("Missing url parameter");
      }
      return;
    }
    await this.linkPreviewService.pipeImage(rawUrl, reply);
  }
}

