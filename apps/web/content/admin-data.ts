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
  dripFeedCount?: number;
  refillCount?: number;
  cancelCount?: number;
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

import { Ticket } from "@smm/contracts";

export const INITIAL_ADMIN_COUPONS: AdminCoupon[] = [];

export const INITIAL_ADMIN_TICKETS: Ticket[] = [
  {
    id: "TCK-8921",
    userId: "usr_demo_1",
    subject: "Refill request for Order #ORD-44910 (Instagram Followers)",
    department: "SERVICE_REFILL",
    priority: "HIGH",
    status: "OPEN",
    orderId: "ORD-44910",
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    messages: [
      {
        id: "msg-1",
        ticketId: "TCK-8921",
        authorId: "usr_demo_1",
        authorName: "Rahul Sharma",
        authorRole: "USER",
        content: "Hi Admin, I noticed a 500 followers drop on order ORD-44910. The service was marked refillable. Can you please trigger an upstream refill?",
        attachments: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
    ],
  },
  {
    id: "TCK-8922",
    userId: "usr_demo_2",
    subject: "UPI Payment deducted (₹2,500) but wallet balance not updated",
    department: "PAYMENT_BILLING",
    priority: "CRITICAL",
    status: "IN_REVIEW",
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    messages: [
      {
        id: "msg-2",
        ticketId: "TCK-8922",
        authorId: "usr_demo_2",
        authorName: "Aarav Patel",
        authorRole: "USER",
        content: "I transferred ₹2,500 via PhonePe UPI. UTR / Reference number is UPI98237192. Please credit my wallet balance.",
        attachments: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      },
      {
        id: "msg-3",
        ticketId: "TCK-8922",
        authorId: "admin",
        authorName: "Root Admin",
        authorRole: "ADMIN",
        content: "Checking with our payment gateway webhook ledger now. Please hold on.",
        attachments: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
    ],
  },
  {
    id: "TCK-8920",
    userId: "usr_demo_3",
    subject: "API Integration question regarding custom comments payload",
    department: "API_INTEGRATION",
    priority: "MEDIUM",
    status: "ANSWERED",
    lastReplyAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 700).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    messages: [
      {
        id: "msg-4",
        ticketId: "TCK-8920",
        authorId: "usr_demo_3",
        authorName: "Pooja Verma",
        authorRole: "USER",
        content: "Does your /api/v1/orders endpoint support custom comments payload for YouTube custom comments service?",
        attachments: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 700).toISOString(),
      },
      {
        id: "msg-5",
        ticketId: "TCK-8920",
        authorId: "admin",
        authorName: "Support Staff",
        authorRole: "ADMIN",
        content: "Yes, you can pass 'comments' field separated by newline (\\n) in the JSON payload to /api/v1/orders.",
        attachments: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
      },
    ],
  },
];
