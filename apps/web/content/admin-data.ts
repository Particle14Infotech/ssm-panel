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

export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: "usr_998124aether",
    name: "Alex Vance",
    email: "growth.lead@nexusmedia.io",
    balance: 2450.0,
    totalSpent: 48920.0,
    totalOrders: 125,
    tier: "PRO_SCALE",
    status: "ACTIVE",
    createdAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "usr_881920",
    name: "Vikram Sharma",
    email: "vikram@viralscale.in",
    balance: 14200.0,
    totalSpent: 184500.0,
    totalOrders: 642,
    tier: "ENTERPRISE",
    status: "ACTIVE",
    createdAt: "2025-11-20T14:10:00Z",
  },
  {
    id: "usr_772109",
    name: "Elena Rostova",
    email: "elena@cryptoapex.agency",
    balance: 850.0,
    totalSpent: 31200.0,
    totalOrders: 89,
    tier: "GROWTH",
    status: "ACTIVE",
    createdAt: "2026-02-04T18:00:00Z",
  },
  {
    id: "usr_665412",
    name: "Rahul Verma",
    email: "rahul@botflow.digital",
    balance: 0.0,
    totalSpent: 450.0,
    totalOrders: 2,
    tier: "STARTER",
    status: "SUSPENDED",
    createdAt: "2026-03-01T11:45:00Z",
  },
];

export const INITIAL_ADMIN_PROVIDERS: AdminProvider[] = [
  {
    id: "prov_smm_main",
    name: "ApexSMM Global API (Direct Node 01)",
    apiUrl: "https://api.apexsmm.com/v2",
    apiKey: "sk_live_9981a8b9281c818902",
    balance: 4820.5,
    currency: "USD",
    status: "CONNECTED",
    serviceCount: 420,
    lastSyncAt: "2026-10-10T15:40:00Z",
  },
  {
    id: "prov_speed_router",
    name: "HyperRoute High-Speed SMM Provider",
    apiUrl: "https://hyperroute-api.io/v1",
    apiKey: "hr_sec_491823901923019",
    balance: 1980.25,
    currency: "USD",
    status: "CONNECTED",
    serviceCount: 154,
    lastSyncAt: "2026-10-10T15:42:00Z",
  },
  {
    id: "prov_crypto_traffic",
    name: "Telegram & Crypto Boost VIP Node",
    apiUrl: "https://tg-boost-api.net/v3",
    apiKey: "tg_node_7719280198213",
    balance: 620.0,
    currency: "USD",
    status: "CONNECTED",
    serviceCount: 48,
    lastSyncAt: "2026-10-10T15:35:00Z",
  },
];

export const INITIAL_ADMIN_COUPONS: AdminCoupon[] = [
  {
    id: "CPN-01",
    code: "AETHER10",
    discountType: "PERCENT",
    discountValue: 10,
    minDeposit: 1000,
    maxDiscount: 500,
    usageCount: 48,
    maxUsage: 500,
    expiresAt: "2026-12-31T23:59:59Z",
    active: true,
  },
  {
    id: "CPN-02",
    code: "VIPGROWTH20",
    discountType: "PERCENT",
    discountValue: 20,
    minDeposit: 5000,
    maxDiscount: 2000,
    usageCount: 19,
    maxUsage: 100,
    expiresAt: "2026-11-30T23:59:59Z",
    active: true,
  },
  {
    id: "CPN-03",
    code: "WELCOME100",
    discountType: "FIXED",
    discountValue: 100,
    minDeposit: 500,
    usageCount: 142,
    maxUsage: 1000,
    expiresAt: "2026-12-31T23:59:59Z",
    active: true,
  },
];
