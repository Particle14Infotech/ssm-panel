import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";

export interface MockOAuthState {
  state: string;
  userId: string;
  createdAt: number; // ms timestamp
  expiresAt: number; // ms timestamp (10 min)
  used: boolean;
}

export interface MockInstagramUser {
  id: string;
  username: string;
  accountType: "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL";
}

export interface MockInstagramMediaItem {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  permalink: string;
  timestamp: string; // ISO-8601
  isDeleted?: boolean;
}

export class MockInstagramServer {
  private states = new Map<string, MockOAuthState>();
  private authCodes = new Map<string, { code: string; userId: string; user: MockInstagramUser; expiresAt: number; used: boolean }>();
  private tokens = new Map<string, { token: string; userId: string; accountId: string; expiresAt: number; createdAt: number }>();
  private mediaByAccount = new Map<string, MockInstagramMediaItem[]>();

  // Fault injection controls
  public injectExpiredCode = false;
  public injectDeniedConsent = false;
  public injectPersonalAccount = false;
  public injectRateLimit = false; // 429
  public injectExpiredToken = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.states.clear();
    this.authCodes.clear();
    this.tokens.clear();
    this.mediaByAccount.clear();
    this.injectExpiredCode = false;
    this.injectDeniedConsent = false;
    this.injectPersonalAccount = false;
    this.injectRateLimit = false;
    this.injectExpiredToken = false;
  }

  /**
   * Generates a random single-use state bound to user with 10 min TTL
   */
  generateOAuthState(userId: string): { state: string; authorizeUrl: string } {
    const randomHex = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const state = `state_${randomHex}_${userId}`;
    const now = Date.now();

    this.states.set(state, {
      state,
      userId,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      used: false,
    });

    const appId = process.env.INSTAGRAM_APP_ID || "REPLACE_ME_APP_ID";
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || "http://localhost:3000/connections/instagram/callback";

    const authorizeUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=instagram_business_basic&state=${state}`;

    return { state, authorizeUrl };
  }

  /**
   * Validates state parameter: single-use, matching user, unexpired
   */
  validateAndConsumeState(state: string, expectedUserId?: string): MockOAuthState {
    const entry = this.states.get(state);
    if (!entry) {
      throw new BadRequestException("Invalid OAuth state: unknown or invalid state parameter.");
    }
    if (entry.used) {
      throw new BadRequestException("Invalid OAuth state: state has already been used (replay detected).");
    }
    if (Date.now() > entry.expiresAt) {
      throw new BadRequestException("OAuth state expired: authentication window of 10 minutes elapsed.");
    }
    if (expectedUserId && entry.userId !== expectedUserId) {
      throw new ForbiddenException("OAuth state user mismatch: state not bound to current session.");
    }

    entry.used = true;
    return entry;
  }

  /**
   * Generates authorization code for testing
   */
  createTestAuthCode(userId: string, customUser?: Partial<MockInstagramUser>): string {
    const code = `code_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const user: MockInstagramUser = {
      id: customUser?.id || `ig_acc_${Math.floor(100000 + Math.random() * 900000)}`,
      username: customUser?.username || "test_business_brand",
      accountType: customUser?.accountType || (this.injectPersonalAccount ? "PERSONAL" : "BUSINESS"),
    };

    const expiresAt = this.injectExpiredCode ? Date.now() - 1000 : Date.now() + 5 * 60 * 1000;

    this.authCodes.set(code, {
      code,
      userId,
      user,
      expiresAt,
      used: false,
    });

    return code;
  }

  /**
   * Exchanges code for access token and retrieves profile
   */
  exchangeCodeForToken(code: string, redirectUri: string) {
    if (this.injectDeniedConsent) {
      throw new BadRequestException("OAuth error: user denied consent (error 10: permission_denied).");
    }
    if (this.injectRateLimit) {
      throw new BadRequestException("OAuth error 4: Application request limit reached (HTTP 429).");
    }

    const entry = this.authCodes.get(code);
    if (!entry) {
      throw new BadRequestException("Invalid authorization code: code not found or expired (error 100).");
    }
    if (entry.used) {
      throw new BadRequestException("Authorization code has already been consumed (error 100).");
    }
    if (Date.now() > entry.expiresAt) {
      throw new BadRequestException("Authorization code has expired (error 100).");
    }

    entry.used = true;

    // Check account type: reject personal accounts
    if (entry.user.accountType === "PERSONAL") {
      throw new BadRequestException(
        "Unsupported account type: only Instagram Professional (Business or Creator) accounts can be connected (error 24)."
      );
    }

    const token = `IGQV_${Math.random().toString(36).substring(2)}_${entry.user.id}`;
    const now = Date.now();
    const expiresAt = now + 60 * 24 * 3600 * 1000; // 60 days

    this.tokens.set(token, {
      token,
      userId: entry.userId,
      accountId: entry.user.id,
      expiresAt,
      createdAt: now,
    });

    return {
      accessToken: token,
      tokenExpiresAt: new Date(expiresAt),
      user: entry.user,
    };
  }

  /**
   * Refreshes long-lived access token
   */
  refreshToken(token: string) {
    if (this.injectRateLimit) {
      throw new BadRequestException("Rate limit 429 during token refresh.");
    }
    const existing = this.tokens.get(token);
    if (!existing || this.injectExpiredToken) {
      throw new BadRequestException("Invalid or expired access token (error 190).");
    }

    const newToken = `IGQV_REFRESHED_${Math.random().toString(36).substring(2)}_${existing.accountId}`;
    const now = Date.now();
    const expiresAt = now + 60 * 24 * 3600 * 1000;

    this.tokens.delete(token);
    this.tokens.set(newToken, {
      token: newToken,
      userId: existing.userId,
      accountId: existing.accountId,
      expiresAt,
      createdAt: now,
    });

    return {
      accessToken: newToken,
      tokenExpiresAt: new Date(expiresAt),
    };
  }

  /**
   * Populates mock media for an account
   */
  setAccountMedia(accountId: string, media: MockInstagramMediaItem[]) {
    this.mediaByAccount.set(accountId, media);
  }

  /**
   * Queries media endpoint
   */
  getMedia(token: string, limit = 10): MockInstagramMediaItem[] {
    if (this.injectRateLimit) {
      throw new BadRequestException("Rate limit 429 during media fetch.");
    }
    const t = this.tokens.get(token);
    if (!t || this.injectExpiredToken) {
      throw new BadRequestException("Invalid or expired access token (error 190).");
    }

    const list = this.mediaByAccount.get(t.accountId) || [];
    return list.slice(0, limit);
  }
}

export const mockInstagramServer = new MockInstagramServer();
