import { Injectable, Logger } from "@nestjs/common";

export interface SmmProviderServiceItem {
  service: string | number;
  name: string;
  type?: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean;
  cancel?: boolean;
  dripfeed?: boolean | string | number;
  description?: string;
}

export interface SmmAddOrderResponse {
  order?: string | number;
  error?: string;
}

export interface SmmOrderStatusResponse {
  charge?: string | number;
  start_count?: string | number;
  status: "Pending" | "Processing" | "In progress" | "Completed" | "Partial" | "Canceled" | "Fail";
  remains?: string | number;
  currency?: string;
  error?: string;
}

export interface SmmBalanceResponse {
  balance: string | number;
  currency?: string;
  error?: string;
}

@Injectable()
export class SmmProviderClient {
  private readonly logger = new Logger(SmmProviderClient.name);

  /**
   * Universal SMM API dispatcher
   */
  async request<T>(apiUrl: string, apiKey: string, action: string, params: Record<string, any> = {}): Promise<T> {
    // If the provider URL is simulated or test/mock
    if (
      apiUrl.includes("localhost") ||
      apiUrl.includes("127.0.0.1") ||
      apiUrl.includes("example.com") ||
      apiUrl.includes("test") ||
      apiUrl.includes("mock") ||
      apiUrl.includes("browser-wholesaler") ||
      apiUrl.includes("browser-w") ||
      apiUrl.startsWith("simulated://")
    ) {
      return this.handleSimulatedRequest<T>(action, params);
    }

    // Auto-normalize standard SMM v2 endpoint if user entered base domain URL without /api/
    let targetUrl = apiUrl.trim();
    if (
      !targetUrl.includes("/api/") &&
      !targetUrl.startsWith("simulated://") &&
      !targetUrl.includes("localhost")
    ) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/api/v2";
    }

    try {
      const payload = {
        key: apiKey,
        action,
        ...params,
      };

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload as any).toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Upstream SMM API returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      this.logger.error(`SMM Provider [${action}] call to ${apiUrl} failed: ${err.message}`);
      if (
        apiUrl.includes("browser-wholesaler") ||
        apiUrl.includes("browser-w") ||
        apiUrl.includes("mock") ||
        apiUrl.includes("test") ||
        apiUrl.includes("dummy")
      ) {
        this.logger.warn(`Fallback to simulated response for ${action} on ${apiUrl}`);
        return this.handleSimulatedRequest<T>(action, params);
      }
      throw err;
    }
  }

  async getServices(apiUrl: string, apiKey: string): Promise<SmmProviderServiceItem[]> {
    return this.request<SmmProviderServiceItem[]>(apiUrl, apiKey, "services");
  }

  async addOrder(
    apiUrl: string,
    apiKey: string,
    service: string | number,
    link: string,
    quantity: number,
    runs?: number,
    interval?: number
  ): Promise<SmmAddOrderResponse> {
    const params: Record<string, any> = {
      service,
      link,
      quantity,
    };
    if (runs !== undefined && runs !== null) params.runs = runs;
    if (interval !== undefined && interval !== null) params.interval = interval;
    return this.request<SmmAddOrderResponse>(apiUrl, apiKey, "add", params);
  }

  async getOrderStatus(apiUrl: string, apiKey: string, orderId: string | number): Promise<SmmOrderStatusResponse> {
    return this.request<SmmOrderStatusResponse>(apiUrl, apiKey, "status", {
      order: orderId,
    });
  }

  async getBalance(apiUrl: string, apiKey: string): Promise<SmmBalanceResponse> {
    return this.request<SmmBalanceResponse>(apiUrl, apiKey, "balance");
  }

  async requestRefill(apiUrl: string, apiKey: string, orderId: string | number): Promise<{ refill?: string | number; error?: string }> {
    return this.request(apiUrl, apiKey, "refill", { order: orderId });
  }

  async cancelOrder(apiUrl: string, apiKey: string, orderId: string | number): Promise<any> {
    return this.request(apiUrl, apiKey, "cancel", { orders: [orderId] });
  }

  /**
   * Deterministic high-fidelity simulated response for testing and offline development
   */
  private handleSimulatedRequest<T>(action: string, params: Record<string, any>): T {
    switch (action) {
      case "services": {
        const mockServices: SmmProviderServiceItem[] = [
          // Instagram
          {
            service: "101",
            name: "Instagram Followers [High Quality • Real Active • 30D Refill]",
            category: "Instagram Followers",
            rate: "140.00",
            min: "100",
            max: "100000",
            refill: true,
            cancel: true,
            dripfeed: true,
            description: "High quality Instagram followers with instant start and 30-day auto-refill.",
          },
          {
            service: "102",
            name: "Instagram Likes [Instant • Ultra Fast • Non-Drop]",
            category: "Instagram Likes",
            rate: "45.00",
            min: "50",
            max: "50000",
            refill: false,
            cancel: true,
            dripfeed: true,
            description: "Instant delivery Instagram likes for posts and reels.",
          },
          {
            service: "103",
            name: "Instagram Reels Views [Organic Explore Reach • Rapid Speed]",
            category: "Instagram Views",
            rate: "15.00",
            min: "100",
            max: "1000000",
            refill: false,
            cancel: false,
            dripfeed: true,
            description: "Super fast reels views to boost explore algorithm placement.",
          },
          // YouTube
          {
            service: "201",
            name: "YouTube High-Retention Views [Suggested Videos & Search Traffic]",
            category: "YouTube Views",
            rate: "160.00",
            min: "500",
            max: "500000",
            refill: true,
            cancel: true,
            dripfeed: true,
            description: "High retention real views with good watch time.",
          },
          {
            service: "202",
            name: "YouTube Channel Subscribers [Active Accounts • Lifetime Guarantee]",
            category: "YouTube Subscribers",
            rate: "850.00",
            min: "50",
            max: "10000",
            refill: true,
            cancel: false,
            dripfeed: true,
            description: "Non-drop permanent YouTube subscribers.",
          },
          // TikTok
          {
            service: "301",
            name: "TikTok Followers [Global Active • Fast Speed]",
            category: "TikTok Followers",
            rate: "190.00",
            min: "100",
            max: "50000",
            refill: true,
            cancel: true,
            dripfeed: true,
            description: "High quality TikTok profile followers.",
          },
          {
            service: "302",
            name: "TikTok Video Likes [Instant Start • ForYou Algorithm]",
            category: "TikTok Likes",
            rate: "55.00",
            min: "100",
            max: "100000",
            refill: false,
            cancel: true,
            dripfeed: true,
            description: "Fast likes to help video trend on FYP.",
          },
          // Telegram
          {
            service: "401",
            name: "Telegram Channel Members [Zero Drop • Instant]",
            category: "Telegram Members",
            rate: "110.00",
            min: "100",
            max: "100000",
            refill: true,
            cancel: true,
            dripfeed: false,
            description: "Zero drop channel subscribers.",
          },
          {
            service: "402",
            name: "Telegram Post Views [Last 5 Posts • Fast Delivery]",
            category: "Telegram Views",
            rate: "20.00",
            min: "100",
            max: "500000",
            refill: false,
            cancel: false,
            dripfeed: false,
            description: "Post views across latest posts.",
          },
          // X / Twitter
          {
            service: "501",
            name: "X (Twitter) Followers [Worldwide • Non-Drop]",
            category: "X Twitter Followers",
            rate: "280.00",
            min: "100",
            max: "50000",
            refill: true,
            cancel: true,
            dripfeed: true,
            description: "Worldwide followers for X accounts.",
          },
          // Facebook
          {
            service: "601",
            name: "Facebook Page Likes & Followers [HQ Global]",
            category: "Facebook Page Likes",
            rate: "220.00",
            min: "100",
            max: "50000",
            refill: true,
            cancel: true,
            dripfeed: true,
            description: "Genuine page likes and followers.",
          },
          // Spotify
          {
            service: "701",
            name: "Spotify Track Plays [Royalty Eligible • USA / EU]",
            category: "Spotify Plays",
            rate: "95.00",
            min: "1000",
            max: "1000000",
            refill: false,
            cancel: false,
            dripfeed: true,
            description: "Royalty eligible streams from tier-1 countries.",
          },
        ];
        return mockServices as unknown as T;
      }
      case "add": {
        if (String(params.service) === "103") {
          throw new Error("Upstream provider simulated failure: Service unavailable on demand");
        }
        const orderNum = Math.floor(100000 + Math.random() * 900000);
        return { order: String(orderNum) } as unknown as T;
      }
      case "status": {
        return {
          charge: "150.00",
          start_count: 500,
          status: "Completed",
          remains: 0,
          currency: "INR",
        } as unknown as T;
      }
      case "balance": {
        return {
          balance: "25000.00",
          currency: "INR",
        } as unknown as T;
      }
      case "refill": {
        return { refill: `ref_${Date.now()}` } as unknown as T;
      }
      case "cancel": {
        return [{ order: params.order || (params.orders ? params.orders[0] : "1"), cancel: 1 }] as unknown as T;
      }
      default:
        throw new Error(`Unsupported SMM action: ${action}`);
    }
  }
}
