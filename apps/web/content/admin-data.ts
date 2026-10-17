export interface AdminUser {
  id: string;
  name: string;
  email: string;
  balance: number;
  totalSpent: number;
  totalOrders: number;
  tier: "STARTER" | "GROWTH" | "PRO_SCALE" | "ENTERPRISE";
  status: "ACTIVE" | "SUSPENDED" | "FLAGGED";
  createdAt: string;
}

export interface AdminProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  balance: number;
  currency: string;
  status: "CONNECTED" | "ERROR" | "SYNCING";
  serviceCount: number;
  lastSyncAt: string;
}

export interface AdminCoupon {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minDeposit: number;
  maxDiscount?: number;
  usageCount: number;
  maxUsage?: number;
  expiresAt: string;
  active: boolean;
}

export const INITIAL_ADMIN_USERS: AdminUser[] = [];

export const INITIAL_ADMIN_PROVIDERS: AdminProvider[] = [
  {
    id: "prov_cheapest",
    name: "cheapestsmmpanels",
    apiUrl: "https://cheapestsmmpanels.com/api/v2",
    apiKey: "e691••••64ff",
    balance: 123.06,
    currency: "INR",
    status: "CONNECTED",
    serviceCount: 2531,
    lastSyncAt: new Date().toISOString(),
  },
];

export const INITIAL_ADMIN_COUPONS: AdminCoupon[] = [];
