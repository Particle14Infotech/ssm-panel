import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { encryptToken, decryptToken } from "./crypto.util";
import { mockInstagramServer, MockInstagramMediaItem } from "./mock-instagram";
import { ConnectionStatus, MonitoredMediaState, PackageStatus } from "@prisma/client";

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
   * Generates OAuth authorization start URL with random single-use state bound to user (10 min TTL)
   * POST /connections/instagram/start
   */
  startConnect(userId: string): { authorizeUrl: string; state: string } {
    return mockInstagramServer.generateOAuthState(userId);
  }

  /**
   * Convenience connect helper for tests and sandbox mode
   */
  async connectAccount(userId: string, dto: ConnectAccountDto) {
    const code = mockInstagramServer.createTestAuthCode(userId, {
      id: dto.platformAccountId,
      username: dto.username,
      accountType: (dto.accountType as any) || "BUSINESS",
    });
    const { state } = mockInstagramServer.generateOAuthState(userId);
    const conn = await this.handleCallback(userId, code, state);
    return {
      ...conn,
      connectionStatus: "CONNECTED",
    };
  }

  /**
   * Handles OAuth Callback:
   * 1. Validates state (single-use, bound to user, 10 min window)
   * 2. Exchanges code for short-lived -> long-lived token (60 days)
   * 3. Queries /me for id, username, account_type
   * 4. Rejects non-professional accounts
   * 5. Refuses account already connected to another user
   * 6. Saves immutable account id, AES-256-GCM token, baselineAt = now
   * GET /connections/instagram/callback
   */
  async handleCallback(userId: string, code: string, state: string) {
    if (!code) {
      throw new BadRequestException("Authorization code is required.");
    }
    if (!state) {
      throw new BadRequestException("OAuth state parameter is required.");
    }

    // 1. Validate state
    mockInstagramServer.validateAndConsumeState(state, userId);

    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || "http://localhost:3000/connections/instagram/callback";

    // 2. Exchange code for token and account details
    const authResult = mockInstagramServer.exchangeCodeForToken(code, redirectUri);
    const { accessToken, tokenExpiresAt, user } = authResult;

    const cleanUsername = user.username.replace(/^@/, "").trim().toLowerCase();
    const encryptedToken = encryptToken(accessToken);
    const baselineAt = new Date();

    if (!this.prisma.isConnected) {
      // Sandbox fallback
      for (const existing of this.sandboxConnections.values()) {
        if (existing.providerAccountId === user.id && existing.userId !== userId) {
          throw new ConflictException("This Instagram account is already connected to another user.");
        }
      }
      const connId = `conn_mock_${Date.now()}`;
      const conn = {
        id: connId,
        userId,
        platform: "INSTAGRAM",
        providerAccountId: user.id,
        username: cleanUsername,
        status: ConnectionStatus.ACTIVE,
        tokenEnc: encryptedToken,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        baselineAt: baselineAt.toISOString(),
        nextPollAt: new Date(Date.now() + 120 * 1000).toISOString(),
        pollIntervalSec: 120,
        failureCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.sandboxConnections.set(connId, conn);
      return {
        id: conn.id,
        username: conn.username,
        platformAccountId: conn.providerAccountId,
        status: conn.status,
        baselineAt: conn.baselineAt,
      };
    }

    // 3. Database check: refuse account already connected to another user
    const existingOther = await this.prisma.sourceConnection.findFirst({
      where: {
        platform: "INSTAGRAM",
        providerAccountId: user.id,
        userId: { not: userId },
      },
    });

    if (existingOther) {
      throw new ConflictException("This Instagram account is already connected to another user.");
    }

    // 4. Upsert connection for this user
    const connection = await this.prisma.sourceConnection.upsert({
      where: {
        platform_providerAccountId: {
          platform: "INSTAGRAM",
          providerAccountId: user.id,
        },
      },
      update: {
        userId,
        username: cleanUsername,
        status: ConnectionStatus.ACTIVE,
        tokenEnc: encryptedToken,
        tokenExpiresAt,
        baselineAt,
        nextPollAt: new Date(Date.now() + 120 * 1000),
        failureCount: 0,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform: "INSTAGRAM",
        providerAccountId: user.id,
        username: cleanUsername,
        status: ConnectionStatus.ACTIVE,
        tokenEnc: encryptedToken,
        tokenExpiresAt,
        baselineAt,
        nextPollAt: new Date(Date.now() + 120 * 1000),
        pollIntervalSec: 120,
        failureCount: 0,
      },
      select: {
        id: true,
        userId: true,
        platform: true,
        providerAccountId: true,
        username: true,
        status: true,
        baselineAt: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
    });

    return connection;
  }

  /**
   * Lists all connected accounts for the user (never leaks tokenEnc)
   * GET /connections
   */
  async listConnections(userId: string) {
    if (!this.prisma.isConnected) {
      return Array.from(this.sandboxConnections.values())
        .filter((c) => c.userId === userId)
        .map((c) => ({
          id: c.id,
          username: c.username,
          providerAccountId: c.providerAccountId,
          platform: c.platform,
          status: c.status,
          baselineAt: c.baselineAt,
          tokenExpiresAt: c.tokenExpiresAt,
          createdAt: c.createdAt,
        }));
    }

    return this.prisma.sourceConnection.findMany({
      where: { userId },
      select: {
        id: true,
        platform: true,
        providerAccountId: true,
        username: true,
        status: true,
        baselineAt: true,
        tokenExpiresAt: true,
        createdAt: true,
        packages: {
          where: { status: PackageStatus.ACTIVE },
          select: { id: true, handle: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Deletes / revokes connection and pauses associated active packages
   * DELETE /connections/:id
   */
  async deleteConnection(userId: string, connectionId: string) {
    if (!this.prisma.isConnected) {
      const conn = this.sandboxConnections.get(connectionId);
      if (!conn || conn.userId !== userId) throw new NotFoundException("Connection not found.");
      conn.status = ConnectionStatus.REVOKED;
      conn.tokenEnc = null;
      return { success: true, message: "Connection revoked." };
    }

    const conn = await this.prisma.sourceConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException("Connection not found.");

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark connection REVOKED and wipe token
      await tx.sourceConnection.update({
        where: { id: connectionId },
        data: {
          status: ConnectionStatus.REVOKED,
          tokenEnc: null,
          tokenExpiresAt: null,
        },
      });

      // 2. Pause associated active packages
      await tx.package.updateMany({
        where: { connectionId, status: PackageStatus.ACTIVE },
        data: { status: PackageStatus.PAUSED },
      });
    });

    return { success: true, message: "Connection revoked and active packages paused." };
  }

  /**
   * Token refresh background job:
   * Refreshes tokens expiring within 15 days that are at least 24 hours old.
   * On failure, marks connection as NEEDS_RECONNECT and pauses packages.
   */
  async refreshTokenJob(): Promise<{ refreshed: number; failed: number }> {
    if (!this.prisma.isConnected) return { refreshed: 0, failed: 0 };

    const now = new Date();
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 3600 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);

    const expiringConnections = await this.prisma.sourceConnection.findMany({
      where: {
        status: ConnectionStatus.ACTIVE,
        tokenExpiresAt: { lte: fifteenDaysFromNow },
        createdAt: { lte: twentyFourHoursAgo },
        tokenEnc: { not: null },
      },
      take: 20,
    });

    let refreshed = 0;
    let failed = 0;

    for (const conn of expiringConnections) {
      try {
        const decrypted = decryptToken(conn.tokenEnc!);
        if (!decrypted) throw new Error("Could not decrypt token");

        const result = mockInstagramServer.refreshToken(decrypted);
        const newEnc = encryptToken(result.accessToken);

        await this.prisma.sourceConnection.update({
          where: { id: conn.id },
          data: {
            tokenEnc: newEnc,
            tokenExpiresAt: result.tokenExpiresAt,
            failureCount: 0,
          },
        });
        refreshed++;
      } catch (err: any) {
        failed++;
        this.logger.warn(`Token refresh failed for connection ${conn.id}: ${err.message}`);

        await this.prisma.$transaction(async (tx) => {
          await tx.sourceConnection.update({
            where: { id: conn.id },
            data: {
              status: ConnectionStatus.NEEDS_RECONNECT,
              failureCount: { increment: 1 },
            },
          });

          await tx.package.updateMany({
            where: { connectionId: conn.id, status: PackageStatus.ACTIVE },
            data: { status: PackageStatus.PAUSED },
          });
        });
      }
    }

    return { refreshed, failed };
  }

  /**
   * Polls connection for new media:
   * 1. baselineAt check: older media is BASELINE, ignored, never processed
   * 2. Detects new posts and records them in MonitoredMedia
   * 3. Adapts poll interval and backoff
   */
  async detectNewMedia(
    connectionId: string,
    packageId?: string,
    simulatedItems?: any[]
  ): Promise<{ detectedCount: number; newItems: DetectedMediaItem[] }> {
    if (!this.prisma.isConnected) {
      const items = simulatedItems || [];
      const newItems: DetectedMediaItem[] = [];
      const existing = this.sandboxMedia.get(connectionId) || [];
      const knownIds = new Set(existing.map((m) => m.mediaId));

      for (const item of items) {
        if (!knownIds.has(item.mediaId)) {
          existing.push(item);
          newItems.push({
            mediaId: item.mediaId,
            permalink: item.permalink,
            mediaType: item.mediaType || "REEL",
            publishedAt: new Date(item.publishedAt),
          });
        }
      }
      this.sandboxMedia.set(connectionId, existing);
      return { detectedCount: newItems.length, newItems };
    }

    const conn = await this.prisma.sourceConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) throw new NotFoundException("Connection not found.");
    if (conn.status !== ConnectionStatus.ACTIVE) {
      return { detectedCount: 0, newItems: [] };
    }

    const decrypted = decryptToken(conn.tokenEnc || "");
    const mediaList = simulatedItems
      ? simulatedItems.map((s) => ({
          id: s.mediaId || s.id,
          permalink: s.permalink,
          media_type: s.mediaType || s.media_type || "REEL",
          timestamp: new Date(s.publishedAt || s.timestamp).toISOString(),
        }))
      : mockInstagramServer.getMedia(decrypted);

    const baselineAt = conn.baselineAt || new Date(0);
    const newItems: DetectedMediaItem[] = [];

    for (const item of mediaList) {
      const publishedAt = new Date(item.timestamp);

      // BASELINE FILTER: older than baselineAt is ignored, never processed!
      if (publishedAt <= baselineAt) {
        continue;
      }

      // Check if media already recorded
      let existingMedia = await this.prisma.monitoredMedia.findUnique({
        where: {
          connectionId_mediaKey: {
            connectionId: conn.id,
            mediaKey: item.id,
          },
        },
      });

      if (!existingMedia) {
        existingMedia = await this.prisma.monitoredMedia.create({
          data: {
            connectionId: conn.id,
            mediaKey: item.id,
            publishedAt,
            state: MonitoredMediaState.NEW,
            permalink: item.permalink,
            mediaType: item.media_type,
          },
        });

        newItems.push({
          mediaId: existingMedia.id,
          permalink: existingMedia.permalink || undefined,
          mediaType: (existingMedia.mediaType as any) || "REEL",
          publishedAt: existingMedia.publishedAt,
        });
      }
    }

    // Update nextPollAt
    await this.prisma.sourceConnection.update({
      where: { id: conn.id },
      data: {
        nextPollAt: new Date(Date.now() + (conn.pollIntervalSec || 120) * 1000),
      },
    });

    return { detectedCount: newItems.length, newItems };
  }

  /**
   * Verifies that the connection belongs to user and is ACTIVE
   */
  async verifyConnectionEligibility(userId: string, connectionId: string) {
    if (!this.prisma.isConnected) {
      const conn = this.sandboxConnections.get(connectionId);
      if (!conn || conn.userId !== userId) {
        throw new ForbiddenException("Account connection does not belong to user.");
      }
      return conn;
    }

    const conn = await this.prisma.sourceConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) {
      throw new ForbiddenException("Account connection not found or access denied.");
    }
    if (conn.status !== ConnectionStatus.ACTIVE) {
      throw new BadRequestException(`Connection is in status "${conn.status}". Reconnect required.`);
    }
    return conn;
  }

  /**
   * Deauthorize callback from Meta
   */
  async handleDeauthorize(platformAccountId: string) {
    if (!this.prisma.isConnected) return { success: true };
    await this.prisma.$transaction(async (tx) => {
      const conn = await tx.sourceConnection.findUnique({
        where: {
          platform_providerAccountId: {
            platform: "INSTAGRAM",
            providerAccountId: platformAccountId,
          },
        },
      });
      if (conn) {
        await tx.sourceConnection.update({
          where: { id: conn.id },
          data: { status: ConnectionStatus.REVOKED, tokenEnc: null },
        });
        await tx.package.updateMany({
          where: { connectionId: conn.id, status: PackageStatus.ACTIVE },
          data: { status: PackageStatus.PAUSED },
        });
      }
    });
    return { success: true };
  }
}
