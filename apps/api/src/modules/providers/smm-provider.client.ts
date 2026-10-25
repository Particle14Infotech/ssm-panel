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
      apiUrl.includes("example.com") ||
      apiUrl.includes("test") ||
      apiUrl.includes("mock") ||
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
          {
            service: "101",
            name: "High Retention Views (Simulated)",
            category: "YouTube Views",
            rate: "120.00",
            min: "100",
            max: "500000",
            refill: true,
            cancel: true,
            description: "High retention real traffic simulated via upstream node.",
          },
          {
            service: "102",
            name: "Targeted Instagram Followers (Simulated)",
            category: "Instagram Followers",
            rate: "150.00",
            min: "50",
            max: "100000",
            refill: false,
            cancel: true,
            description: "Direct delivery followers with cancel enabled.",
          },
          {
            service: "103",
            name: "Failing on Demand Service (Simulated)",
            category: "Instagram Followers",
            rate: "99.00",
            min: "10",
            max: "1000",
            refill: false,
            cancel: false,
            description: "Simulated upstream failure node for QA resilience testing.",
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
