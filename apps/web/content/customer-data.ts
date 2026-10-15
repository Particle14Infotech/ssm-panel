import { ServiceItem, OrderItem, TransactionItem, Ticket, UserProfile } from "@smm/contracts";

export const INITIAL_USER: UserProfile = {
  id: "",
  email: "",
  name: "New Customer",
  phone: "",
  avatarUrl: "",
  balance: 0,
  currency: "INR",
  tier: "STARTER",
  apiKey: "",
  webhookUrl: "",
  twoFactorEnabled: false,
  ipWhitelist: [],
  notificationPreferences: {
    orderUpdates: true,
    marketingAlerts: false,
    securityAlerts: true,
    lowBalanceAlert: false,
    balanceThreshold: 500,
  },
  totalSpent: 0,
  totalOrders: 0,
  createdAt: new Date().toISOString(),
};

export const INITIAL_SERVICES: ServiceItem[] = [];

export const INITIAL_ORDERS: OrderItem[] = [];

export const INITIAL_TRANSACTIONS: TransactionItem[] = [];

export const INITIAL_TICKETS: Ticket[] = [];
