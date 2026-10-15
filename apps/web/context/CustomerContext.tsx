"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserProfile,
  OrderItem,
  ServiceItem,
  TransactionItem,
  Ticket,
  CreateTicketInput,
  PaymentMethod,
  PaymentGatewaySession,
  calculateDepositBonus,
} from "@smm/contracts";

export const EMPTY_USER: UserProfile = {
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

interface CustomerContextType {
  user: UserProfile;
  orders: OrderItem[];
  services: ServiceItem[];
  transactions: TransactionItem[];
  tickets: Ticket[];
  isLoading: boolean;
  logout: () => void;
  refreshData: () => Promise<void>;
  createOrder: (input: {
    serviceId: string;
    target: string;
    quantity: number;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
    couponCode?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  refillOrder: (orderId: string) => Promise<boolean>;
  initiateDeposit: (input: {
    amount: number;
    method: PaymentMethod;
    couponCode?: string;
    idempotencyKey?: string;
  }) => Promise<PaymentGatewaySession>;
  verifyDeposit: (referenceId: string) => Promise<{ success: boolean; session?: PaymentGatewaySession }>;
  depositFunds: (amount: number, method: PaymentMethod) => Promise<{ success: boolean; bonus: number; total: number }>;
  processPartialOrder: (orderId: string, remains: number) => Promise<boolean>;
  processFailedOrder: (orderId: string) => Promise<boolean>;
  createTicket: (input: CreateTicketInput) => Promise<{ success: boolean; ticketId?: string }>;
  replyTicket: (ticketId: string, message: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  regenerateApiKey: () => string;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    setUser(EMPTY_USER);
    setOrders([]);
    setTransactions([]);
    setTickets([]);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const refreshData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(EMPTY_USER);
      setOrders([]);
      setTransactions([]);
      setTickets([]);
      setIsLoading(false);
      return;
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      setIsLoading(true);

      // 1. Fetch Profile and Balance concurrently
      const [profileRes, balanceRes] = await Promise.all([
        fetch(`${API_BASE}/users/me`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/wallet/balance`, { headers: authHeaders, cache: "no-store" }),
      ]);

      if (profileRes.status === 401 || balanceRes.status === 401) {
        logout();
        return;
      }

      let profileData: any = null;
      let balanceData: any = null;

      if (profileRes.ok) {
        profileData = await profileRes.json();
      }
      if (balanceRes.ok) {
        balanceData = await balanceRes.json();
      }

      if (profileData) {
        setUser((prev) => ({
          ...prev,
          id: profileData.id,
          email: profileData.email,
          name: profileData.name || "Customer",
          role: profileData.role,
          tier: profileData.tier || "STANDARD",
          balance: typeof balanceData?.balance === "number" ? balanceData.balance : 0,
        }));
      }

      // 2. Fetch Orders, Ledger, Tickets, Services concurrently
      const [ordersRes, ledgerRes, ticketsRes, servicesRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/wallet/ledger`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/tickets`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/services`, { cache: "no-store" }),
      ]);

      if (ordersRes.ok) {
        const rawOrders = await ordersRes.json();
        if (Array.isArray(rawOrders)) {
          setOrders(
            rawOrders.map((o: any) => ({
              id: o.id,
              userId: o.userId,
              serviceId: o.serviceId,
              serviceName: o.service?.name || "Service",
              platform: (o.service?.platform || "general").toLowerCase(),
              target: o.target,
              quantity: o.quantity,
              charge: Number(o.charge),
              startCount: o.startCount ?? 0,
              remains: o.remains ?? 0,
              status: o.status,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              refillable: o.service?.refillable ?? false,
              cancellable: o.service?.cancellable ?? false,
            }))
          );
        }
      }

      if (ledgerRes.ok) {
        const rawLedger = await ledgerRes.json();
        if (Array.isArray(rawLedger)) {
          setTransactions(
            rawLedger.map((t: any) => ({
              id: t.id,
              userId: user.id,
              amount: Number(t.amount),
              bonus: 0,
              method: (t.method === "CARD" || t.method === "NETBANKING" ? t.method : "UPI") as "UPI" | "CARD" | "NETBANKING",
              status: "SUCCESS" as const,
              referenceId: t.orderId || t.idempotencyKey || t.id,
              createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
            }))
          );
        }
      }

      if (ticketsRes.ok) {
        const rawTickets = await ticketsRes.json();
        if (Array.isArray(rawTickets)) {
          setTickets(
            rawTickets.map((tk: any) => ({
              id: tk.id,
              userId: tk.userId,
              subject: tk.subject,
              department: "GENERAL_SUPPORT" as const,
              priority: (tk.priority === "HIGH" || tk.priority === "CRITICAL" || tk.priority === "LOW" ? tk.priority : "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
              status: (tk.status === "CLOSED" || tk.status === "RESOLVED" || tk.status === "ANSWERED" ? tk.status : "OPEN") as "OPEN" | "ANSWERED" | "CUSTOMER_REPLY" | "IN_REVIEW" | "RESOLVED" | "CLOSED",
              lastReplyAt: tk.updatedAt ? new Date(tk.updatedAt).toISOString() : new Date().toISOString(),
              messages: Array.isArray(tk.messages)
                ? tk.messages.map((m: any) => ({
                    id: m.id,
                    ticketId: tk.id,
                    authorId: m.senderId,
                    authorName: m.senderId === user.id ? user.name : "Support Staff",
                    authorRole: (m.senderId === user.id ? "USER" : "ADMIN") as "USER" | "ADMIN",
                    content: m.message,
                    attachments: [],
                    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
                  }))
                : [],
              createdAt: tk.createdAt ? new Date(tk.createdAt).toISOString() : new Date().toISOString(),
              updatedAt: tk.updatedAt ? new Date(tk.updatedAt).toISOString() : new Date().toISOString(),
            }))
          );
        }
      }

      if (servicesRes.ok) {
        const rawServices = await servicesRes.json();
        if (Array.isArray(rawServices)) {
          setServices(
            rawServices.map((s: any) => ({
              id: s.id,
              categoryId: s.categoryId || "general",
              categoryName: s.category?.name || "General Services",
              name: s.name,
              platform: s.platform,
              ratePer1000: Number(s.ratePer1000),
              minQty: s.minQty,
              maxQty: s.maxQty,
              avgProcessingSpeed: "Instant",
              avgStartTime: "0 - 15 mins",
              refillable: s.refillable,
              cancellable: s.cancellable,
              description: s.description || "",
              status: s.status,
            }))
          );
        }
      }
    } catch {
      // Keep state resilient
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, logout, user.id, user.name]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const createOrder = async (input: {
    serviceId: string;
    target: string;
    quantity: number;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
    couponCode?: string;
    idempotencyKey?: string;
  }) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in to place an order." };

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId: input.serviceId,
          target: input.target,
          quantity: input.quantity,
          idempotencyKey: input.idempotencyKey || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || "Failed to dispatch order." };
      }

      await refreshData();
      return { success: true, orderId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while creating order." };
    }
  };

  const cancelOrder = async (orderId: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const refillOrder = async (orderId: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/refill`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const initiateDeposit = async (input: {
    amount: number;
    method: PaymentMethod;
    couponCode?: string;
    idempotencyKey?: string;
  }): Promise<PaymentGatewaySession> => {
    const token = getAuthToken();
    const { bonusAmount, totalCredit } = calculateDepositBonus(input.amount);
    const referenceId = `DEP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/payments/initiate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: input.amount,
            method: input.method,
            couponCode: input.couponCode,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            sessionId: data.paymentId || data.gatewayOrderId,
            referenceId: data.gatewayOrderId || referenceId,
            redirectUrl: `/app/wallet/verify?ref=${data.gatewayOrderId || referenceId}`,
            amount: input.amount,
            bonusAmount,
            totalCredit,
            method: input.method,
            status: "PENDING",
          };
        }
      } catch {}
    }

    return {
      sessionId: `sess_${Date.now()}`,
      referenceId,
      redirectUrl: `/app/wallet/verify?ref=${referenceId}`,
      amount: input.amount,
      bonusAmount,
      totalCredit,
      method: input.method,
      status: "PENDING",
    };
  };

  const verifyDeposit = async (referenceId: string) => {
    await refreshData();
    return { success: true };
  };

  const depositFunds = async (amount: number, method: PaymentMethod) => {
    const { bonusAmount, totalCredit } = calculateDepositBonus(amount);
    await refreshData();
    return { success: true, bonus: bonusAmount, total: totalCredit };
  };

  const processPartialOrder = async () => false;
  const processFailedOrder = async () => false;

  const createTicket = async (input: CreateTicketInput) => {
    const token = getAuthToken();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: input.subject,
          message: input.message,
          priority: input.priority || "NORMAL",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshData();
        return { success: true, ticketId: data.ticketId || data.id };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const replyTicket = async (ticketId: string, message: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const regenerateApiKey = () => {
    const newKey = `smm_live_${Math.random().toString(36).substring(2, 15)}`;
    setUser((prev) => ({ ...prev, apiKey: newKey }));
    return newKey;
  };

  return (
    <CustomerContext.Provider
      value={{
        user,
        orders,
        services,
        transactions,
        tickets,
        isLoading,
        logout,
        refreshData,
        createOrder,
        cancelOrder,
        refillOrder,
        initiateDeposit,
        verifyDeposit,
        depositFunds,
        processPartialOrder,
        processFailedOrder,
        createTicket,
        replyTicket,
        updateProfile,
        regenerateApiKey,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return context;
}
