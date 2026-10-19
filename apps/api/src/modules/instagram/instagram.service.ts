import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { encryptToken, decryptToken } from "./crypto.util";
import crypto from "crypto";

export interface ConnectAccountDto {
  platformAccountId: string;
  username: string;
  accountType?: string;
  accessToken?: string;
  expiresInSeconds?: number;
  grantedScopes?: string[];
}

export interface DetectedMediaItem {
  mediaId: string;
  permalink?: string;
  mediaType: "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM";
  caption?: string;
  publishedAt: Date;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private sandboxConnections = new Map<string, any>();
  private sandboxMedia = new Map<string, any[]>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates official Instagram Graph API OAuth authorization URL
   */
  getConnectUrl(userId: string): { url: string; state: string } {
    const appId = process.env.INSTAGRAM_APP_ID || "1234567890";
    const redirectUri =
      process.env.INSTAGRAM_REDIRECT_URI ||
      "http://localhost:3000/api/v1/integrations/instagram/callback";
    const state = crypto.randomBytes(16).toString("hex") + `:${userId}`;

    const scopes = [
      "instagram_basic",
      "instagram_manage_insights",
      "pages_show_list",
    ].join(",");

    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${scopes}&state=${state}&response_type=code`;

    return { url, state };
  }

  /**
   * Connects or updates an authorized Instagram Account
   */
  async connectAccount(userId: string, dto: ConnectAccountDto) {
    const cleanUsername = dto.username.replace(/^@/, "").trim().toLowerCase();
    if (!cleanUsername) {
      throw new BadRequestException("Valid Instagram username is required.");
    }
    if (!dto.platformAccountId) {
      throw new BadRequestException("Platform account ID is required.");
    }

    const encryptedAccessToken = dto.accessToken ? encryptToken(dto.accessToken) : null;
    const tokenExpiresAt = dto.expiresInSeconds
      ? new Date(Date.now() + dto.expiresInSeconds * 1000)
      : new Date(Date.now() + 60 * 24 * 3600 * 1000); // Default 60 days for long-lived tokens

    const scopes = dto.grantedScopes || [
      "instagram_basic",
      "instagram_manage_insights",
    ];

    if (!this.prisma.isConnected) {
      const connId = `ig_conn_${Date.now()}`;
      const conn = {
        id: connId,
        userId,
        platformAccountId: dto.platformAccountId,
        username: cleanUsername,
        accountType: dto.accountType || "BUSINESS",
        grantedScopes: scopes,
        connectionStatus: "CONNECTED",
        lastDetectedAt: null,
        connectedAt: new Date().toISOString(),
        disconnectedAt: null,
      };
      this.sandboxConnections.set(connId, conn);
      return conn;
    }

    const connection = await this.prisma.instagramConnection.upsert({
      where: {
        userId_platformAccountId: {
          userId,
          platformAccountId: dto.platformAccountId,
        },
      },
      update: {
        username: cleanUsername,
        accountType: dto.accountType || "BUSINESS",
        encryptedAccessToken,
        tokenExpiresAt,
        grantedScopes: scopes,
        connectionStatus: "CONNECTED",
        disconnectedAt: null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platformAccountId: dto.platformAccountId,
        username: cleanUsername,
        accountType: dto.accountType || "BUSINESS",
        encryptedAccessToken,
        tokenExpiresAt,
        grantedScopes: scopes,
        connectionStatus: "CONNECTED",
      },
      select: {
        id: true,
        userId: true,
        platformAccountId: true,
        username: true,
        accountType: true,
        tokenExpiresAt: true,
        grantedScopes: true,
        connectionStatus: true,
        lastDetectedAt: true,
        connectedAt: true,
      },
    });

    return connection;
  }

  /**
   * Retrieves connection status and authorized accounts for authenticated user
   */
  async getStatus(userId: string) {
    if (!this.prisma.isConnected) {
      const connections = Array.from(this.sandboxConnections.values()).filter(
        (c) => c.userId === userId && c.connectionStatus === "CONNECTED"
      );
      return {
        connected: connections.length > 0,
        accounts: connections,
      };
    }

    const connections = await this.prisma.instagramConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platformAccountId: true,
        username: true,
        accountType: true,
        tokenExpiresAt: true,
        grantedScopes: true,
        connectionStatus: true,
        lastDetectedAt: true,
        connectedAt: true,
        packages: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { connectedAt: "desc" },
    });

    return {
      connected: connections.length > 0,
      accounts: connections.map((conn) => ({
        id: conn.id,
        platformAccountId: conn.platformAccountId,
        username: conn.username,
        accountType: conn.accountType,
        tokenExpiresAt: conn.tokenExpiresAt ? conn.tokenExpiresAt.toISOString() : null,
        grantedScopes: conn.grantedScopes,
        connectionStatus: conn.connectionStatus,
        lastDetectedAt: conn.lastDetectedAt ? conn.lastDetectedAt.toISOString() : null,
        connectedAt: conn.connectedAt.toISOString(),
        eligible: conn.connectionStatus === "CONNECTED",
        activePackages: conn.packages,
        missingPermissions: this.checkMissingPermissions(conn.grantedScopes),
      })),
    };
  }

  /**
   * Disconnects an Instagram account
   */
  async disconnect(userId: string, connectionId: string) {
    if (!this.prisma.isConnected) {
      const conn = this.sandboxConnections.get(connectionId);
      if (!conn || conn.userId !== userId) throw new NotFoundException("Connection not found.");
      conn.connectionStatus = "DISCONNECTED";
      conn.disconnectedAt = new Date().toISOString();
      return { success: true };
    }

    const conn = await this.prisma.instagramConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new NotFoundException("Connection not found or unauthorized.");
    }

    await this.prisma.instagramConnection.update({
      where: { id: connectionId },
      data: {
        connectionStatus: "DISCONNECTED",
        disconnectedAt: new Date(),
        encryptedAccessToken: null,
      },
    });

    // Pause any active auto-post monitoring packages for this connection
    await this.prisma.package.updateMany({
      where: { connectionId, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });

    return { success: true };
  }

  /**
   * Verifies that account exists, belongs to user, and is eligible
   */
  async verifyConnectionEligibility(userId: string, connectionId: string) {
    if (!this.prisma.isConnected) {
      const conn = this.sandboxConnections.get(connectionId);
      if (!conn || conn.userId !== userId) {
        throw new ForbiddenException("Connected Instagram account does not belong to you.");
      }
      return conn;
    }

    const conn = await this.prisma.instagramConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!conn) {
      throw new ForbiddenException("Connected Instagram account does not belong to you.");
    }

    if (conn.connectionStatus !== "CONNECTED") {
      throw new BadRequestException(
        `Instagram account @${conn.username} is ${conn.connectionStatus}. Re-authorization required.`
      );
    }

    return conn;
  }

  /**
   * Detects new media from Instagram and persists in MonitoredMedia.
   * Guarantees UNIQUE(connectionId, mediaId) deduplication.
   */
  async detectNewMedia(
    connectionId: string,
    packageId?: string,
    simulatedItems?: DetectedMediaItem[]
  ): Promise<{ detectedCount: number; newItems: any[] }> {
    const conn = this.prisma.isConnected
      ? await this.prisma.instagramConnection.findUnique({
          where: { id: connectionId },
        })
      : this.sandboxConnections.get(connectionId);

    if (!conn) {
      throw new NotFoundException("Instagram connection not found.");
    }

    // Items to evaluate
    const candidateItems: DetectedMediaItem[] =
      simulatedItems || (await this.fetchMediaFromInstagramApi(conn));

    if (!candidateItems || candidateItems.length === 0) {
      return { detectedCount: 0, newItems: [] };
    }

    const newItems: any[] = [];

    if (!this.prisma.isConnected) {
      const existing = this.sandboxMedia.get(connectionId) || [];
      const existingIds = new Set(existing.map((m) => m.mediaId));

      for (const item of candidateItems) {
        if (!existingIds.has(item.mediaId)) {
          const stored = {
            id: `media_${Date.now()}_${item.mediaId}`,
            connectionId,
            packageId: packageId || null,
            ...item,
            publishedAt: item.publishedAt.toISOString(),
            firstDetectedAt: new Date().toISOString(),
          };
          existing.push(stored);
          newItems.push(stored);
        }
      }
      this.sandboxMedia.set(connectionId, existing);
      return { detectedCount: newItems.length, newItems };
    }

    // In database mode:
    const now = new Date();
    for (const item of candidateItems) {
      try {
        const created = await this.prisma.monitoredMedia.create({
          data: {
            connectionId,
            packageId: packageId || null,
            mediaId: item.mediaId,
            permalink: item.permalink || `https://instagram.com/p/${item.mediaId}`,
            mediaType: item.mediaType,
            caption: item.caption || null,
            publishedAt: item.publishedAt,
            firstDetectedAt: now,
          },
        });
        newItems.push(created);
      } catch (err: any) {
        // Unique constraint violation P2002: already detected, skip safely
        if (err.code !== "P2002") {
          this.logger.warn({ err: err.message }, "Error inserting monitored media");
        }
      }
    }

    if (newItems.length > 0) {
      // Update connection checkpoint
      await this.prisma.instagramConnection.update({
        where: { id: connectionId },
        data: {
          lastDetectedAt: now,
          lastDetectionCursor: candidateItems[0]?.mediaId || null,
        },
      });

      if (packageId) {
        await this.prisma.package.update({
          where: { id: packageId },
          data: {
            postsDetected: { increment: newItems.length },
          },
        });
      }
    }

    return { detectedCount: newItems.length, newItems };
  }

  /**
   * Internal helper to fetch media from Instagram Graph API or bounded sandbox mock
   */
  private async fetchMediaFromInstagramApi(conn: any): Promise<DetectedMediaItem[]> {
    const token = conn.encryptedAccessToken
      ? decryptToken(conn.encryptedAccessToken)
      : null;

    if (!token || token.startsWith("mock") || process.env.SANDBOX_MODE === "true") {
      // Return simulated latest media item for testing / demo
      return [
        {
          mediaId: `ig_media_${Date.now()}`,
          permalink: `https://instagram.com/p/reel_${Date.now()}`,
          mediaType: "REEL",
          caption: "Simulated new reel publication",
          publishedAt: new Date(),
        },
      ];
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${conn.platformAccountId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${token}&limit=10`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`Instagram Graph API responded with status ${res.status}`);
        return [];
      }
      const json: any = await res.json();
      if (!json?.data || !Array.isArray(json.data)) return [];

      return json.data.map((m: any) => ({
        mediaId: m.id,
        permalink: m.permalink,
        mediaType: m.media_type === "VIDEO" ? "REEL" : m.media_type || "IMAGE",
        caption: m.caption,
        publishedAt: new Date(m.timestamp || Date.now()),
      }));
    } catch (err: any) {
      this.logger.error({ err: err.message }, "Failed to fetch from Instagram Graph API");
      return [];
    }
  }

  private checkMissingPermissions(granted: string[]): string[] {
    const required = ["instagram_basic", "instagram_manage_insights"];
    return required.filter((r) => !granted.includes(r));
  }
}
