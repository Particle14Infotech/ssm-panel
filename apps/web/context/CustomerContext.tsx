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
  FavoriteItem,
  CreateFavoriteInput,
  FavoriteSuggestion,
  PackageQuoteInput,
  PackageQuoteResponse,
  PackagePurchaseInput,
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
  favorites: FavoriteItem[];
  favoriteSuggestions: FavoriteSuggestion[];
  packages: any[];
  isLoading: boolean;
  logout: () => void;
  refreshData: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshPackages: () => Promise<void>;
  pausePackage: (packageId: string) => Promise<boolean>;
  resumePackage: (packageId: string) => Promise<boolean>;
  fetchPackageQuote: (input: PackageQuoteInput) => Promise<PackageQuoteResponse | null>;
  purchasePackage: (input: PackagePurchaseInput) => Promise<{ success: boolean; package?: any; error?: string }>;
  cancelPackage: (packageId: string) => Promise<{ success: boolean; refundedAmount?: number; error?: string }>;
  addFavorite: (input: CreateFavoriteInput) => Promise<{ success: boolean; favorite?: FavoriteItem; error?: string }>;
  removeFavorite: (id: string) => Promise<{ success: boolean; error?: string }>;
  dismissSuggestion: (serviceId: string, targetUrl: string) => Promise<{ success: boolean }>;
  createOrder: (input: {
    serviceId: string;
    target: string;
    quantity: number;
    isDripFeed?: boolean;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
    expectedRate?: number;
    couponCode?: string;
    idempotencyKey?: string;
  }) => Promise<{ success: boolean; orderId?: string; order?: any; error?: string }>;
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

function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "https://smm-production-bca7.up.railway.app";
  if (!envUrl.endsWith("/api/v1")) {
    return envUrl.replace(/\/+$/, "") + "/api/v1";
  }
  return envUrl;
}

const API_BASE = getApiBase();

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoriteSuggestions, setFavoriteSuggestions] = useState<FavoriteSuggestion[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
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

      if ((profileRes.status === 401 || balanceRes.status === 401) && !token.startsWith("jwt_demo_")) {
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
          balance: typeof balanceData?.balance === "number" ? balanceData.balance : (prev.balance || 0),
        }));
      } else if (typeof window !== "undefined") {
        const cached = localStorage.getItem("authUser");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser((prev) => ({
              ...prev,
              ...parsed,
              balance: typeof parsed.balance === "number" ? parsed.balance : (prev.balance || 1068.61),
            }));
          } catch {}
        }
      }

      // 2. Fetch Orders, Ledger, Tickets, Services, Favorites, Packages concurrently
      const [ordersRes, ledgerRes, ticketsRes, servicesRes, favoritesRes, suggestionsRes, packagesRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/wallet/ledger`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/tickets`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/services`, { cache: "no-store" }),
        fetch(`${API_BASE}/favorites`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/favorites/suggestions`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/packages`, { headers: authHeaders, cache: "no-store" }),
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
              isDripFeed: o.isDripFeed ?? false,
              runs: o.runs ?? undefined,
              intervalMinutes: o.intervalMinutes ?? undefined,
              quantityPerRun: o.quantityPerRun ?? undefined,
              totalQuantity: o.totalQuantity ?? o.quantity,
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
              displayName: s.displayName,
              platform: s.platform,
              ratePer1000: Number(s.ratePer1000),
              minQty: s.minQty,
              maxQty: s.maxQty,
              packageEligible: s.packageEligible ?? false,
              avgProcessingSpeed: "15 - 30 mins",
              avgStartTime: "0 - 15 mins",
              refillable: s.refillable,
              cancellable: s.cancellable,
              description: s.description || "",
              status: s.status,
              serviceType: s.serviceType || "DEFAULT",
              dripFeedSupported: s.dripFeedSupported ?? false,
              allowManagedDrip: s.allowManagedDrip ?? (s.serviceType !== "CUSTOM_COMMENTS" && !s.name?.toLowerCase().includes("comment")),
              dripFeedMinRuns: s.dripFeedMinRuns ?? null,
              dripFeedMaxRuns: s.dripFeedMaxRuns ?? null,
              dripFeedMinInterval: s.dripFeedMinInterval ?? null,
              dripFeedMaxInterval: s.dripFeedMaxInterval ?? null,
            }))
          );
        }
      } else {
        setServices((prev) => (prev.length > 0 ? prev : [
          {
            id: "1042",
            categoryId: "instagram-growth",
            categoryName: "Instagram Growth",
            name: "Instagram Followers [High Quality • 30D Refill]",
            displayName: "Instagram Followers",
            platform: "INSTAGRAM",
            ratePer1000: 65.0,
            minQty: 100,
            maxQty: 100000,
            packageEligible: true,
            avgProcessingSpeed: "0 - 15 mins",
            avgStartTime: "0 - 5 mins",
            refillable: true,
            cancellable: true,
            description: "High retention real profiles with automated 30 days refill policy.",
            status: "ACTIVE",
            serviceType: "DEFAULT",
            dripFeedSupported: true,
            allowManagedDrip: true,
            dripFeedMinRuns: 2,
            dripFeedMaxRuns: 100,
            dripFeedMinInterval: 10,
            dripFeedMaxInterval: 1440,
          },
          {
            id: "1043",
            categoryId: "instagram-growth",
            categoryName: "Instagram Growth",
            name: "Instagram Reels Views [High Retention • Explore Boost]",
            displayName: "Instagram Reels Views",
            platform: "INSTAGRAM",
            ratePer1000: 24.0,
            minQty: 500,
            maxQty: 5000000,
            packageEligible: true,
            avgProcessingSpeed: "0 - 5 mins",
            avgStartTime: "0 - 5 mins",
            refillable: true,
            cancellable: true,
            description: "Direct delivery high retention video views for Reels explore boost.",
            status: "ACTIVE",
            serviceType: "DEFAULT",
            dripFeedSupported: true,
            allowManagedDrip: true,
            dripFeedMinRuns: 2,
            dripFeedMaxRuns: 100,
            dripFeedMinInterval: 10,
            dripFeedMaxInterval: 1440,
          },
          {
            id: "2015",
            categoryId: "youtube-views",
            categoryName: "YouTube Views",
            name: "YouTube 4K Views [Suggested Videos & High Retention]",
            displayName: "YouTube 4K Views",
            platform: "YOUTUBE",
            ratePer1000: 140.0,
            minQty: 1000,
            maxQty: 1000000,
            packageEligible: true,
            avgProcessingSpeed: "15 - 30 mins",
            avgStartTime: "0 - 15 mins",
            refillable: true,
            cancellable: true,
            description: "Non-drop high CTR views suitable for channel reach.",
            status: "ACTIVE",
            serviceType: "DEFAULT",
            dripFeedSupported: true,
            allowManagedDrip: true,
            dripFeedMinRuns: 2,
            dripFeedMaxRuns: 100,
            dripFeedMinInterval: 10,
            dripFeedMaxInterval: 1440,
          },
          {
            id: "3010",
            categoryId: "telegram-growth",
            categoryName: "Telegram Growth",
            name: "Telegram Channel Members [Global Non-Drop 60D]",
            displayName: "Telegram Channel Members",
            platform: "TELEGRAM",
            ratePer1000: 120.0,
            minQty: 100,
            maxQty: 200000,
            packageEligible: true,
            avgProcessingSpeed: "0 - 10 mins",
            avgStartTime: "0 - 10 mins",
            refillable: true,
            cancellable: true,
            description: "Clean channel members with 60 days replacement window.",
            status: "ACTIVE",
            serviceType: "DEFAULT",
            dripFeedSupported: true,
            allowManagedDrip: true,
            dripFeedMinRuns: 2,
            dripFeedMaxRuns: 100,
            dripFeedMinInterval: 10,
            dripFeedMaxInterval: 1440,
          },
        ]));
      }

      if (favoritesRes && favoritesRes.ok) {
        const rawFavorites = await favoritesRes.json();
        if (Array.isArray(rawFavorites)) {
          setFavorites(rawFavorites);
        }
      }

      if (suggestionsRes && suggestionsRes.ok) {
        const rawSuggestions = await suggestionsRes.json();
        if (Array.isArray(rawSuggestions)) {
          setFavoriteSuggestions(rawSuggestions);
        }
      }

      if (packagesRes && packagesRes.ok) {
        const rawPackages = await packagesRes.json();
        if (Array.isArray(rawPackages)) {
          setPackages(rawPackages);
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
    isDripFeed?: boolean;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
    expectedRate?: number;
    couponCode?: string;
    idempotencyKey?: string;
  }) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in to place an order." };

    try {
      const payload: Record<string, any> = {
        serviceId: input.serviceId,
        target: input.target,
        quantity: input.quantity,
        idempotencyKey: input.idempotencyKey || `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      if (input.expectedRate !== undefined) {
        payload.expectedRate = Number(input.expectedRate);
      }
      if (input.comments !== undefined) {
        payload.comments = input.comments;
      }

      const isDripFeed = Boolean(input.isDripFeed ?? input.dripFeed);
      if (isDripFeed) {
        payload.isDripFeed = true;
        if (input.runs !== undefined) payload.runs = Number(input.runs);
        if (input.interval !== undefined) payload.interval = Number(input.interval);
      }

      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || "Failed to dispatch order." };
      }

      await refreshData();
      return { success: true, orderId: data.id, order: data };
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
        const res = await fetch(`${API_BASE}/payments/create-order`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: input.amount,
            idempotencyKey: input.idempotencyKey,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const gatewayId = data.orderId || data.gatewayOrderId || data.id;
          return {
            sessionId: gatewayId,
            referenceId: gatewayId,
            redirectUrl: `/wallet`,
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

  const refreshFavorites = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const [favRes, sugRes] = await Promise.all([
        fetch(`${API_BASE}/favorites`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/favorites/suggestions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (favRes.ok) {
        const rawFav = await favRes.json();
        if (Array.isArray(rawFav)) setFavorites(rawFav);
      }
      if (sugRes.ok) {
        const rawSug = await sugRes.json();
        if (Array.isArray(rawSug)) setFavoriteSuggestions(rawSug);
      }
    } catch {}
  };

  const addFavorite = async (input: CreateFavoriteInput) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in to save favorites." };
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshFavorites();
        return { success: true, favorite: data };
      }
      return { success: false, error: data.message || "Failed to save favorite." };
    } catch {
      return { success: false, error: "Network error saving favorite." };
    }
  };

  const removeFavorite = async (id: string) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in." };
    try {
      const res = await fetch(`${API_BASE}/favorites/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.id !== id));
        return { success: true };
      }
      return { success: false, error: "Failed to delete favorite." };
    } catch {
      return { success: false, error: "Network error." };
    }
  };

  const dismissSuggestion = async (serviceId: string, targetUrl: string) => {
    const token = getAuthToken();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/favorites/suggestions/dismiss`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceId, targetUrl }),
      });
      if (res.ok) {
        setFavoriteSuggestions((prev) =>
          prev.filter((s) => !(s.serviceId === serviceId && s.targetUrl === targetUrl))
        );
        return { success: true };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const refreshPackages = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const rawPkg = await res.json();
        if (Array.isArray(rawPkg)) setPackages(rawPkg);
      }
    } catch {}
  };

  const fetchPackageQuote = async (input: PackageQuoteInput): Promise<PackageQuoteResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/packages/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  };

  const purchasePackage = async (input: PackagePurchaseInput) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in to purchase packages." };
    try {
      const res = await fetch(`${API_BASE}/packages/purchase`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshData();
        return { success: true, package: data.package };
      }
      return { success: false, error: data.message || "Failed to purchase package." };
    } catch {
      return { success: false, error: "Network error during purchase." };
    }
  };

  const cancelPackage = async (packageId: string) => {
    const token = getAuthToken();
    if (!token) return { success: false, error: "Please log in." };
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        await refreshData();
        return { success: true, refundedAmount: data.refundedAmount };
      }
      return { success: false, error: data.message || "Failed to cancel package." };
    } catch {
      return { success: false, error: "Network error." };
    }
  };

  const pausePackage = async (packageId: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}/pause`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshPackages();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const resumePackage = async (packageId: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/packages/${packageId}/resume`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshPackages();
        return true;
      }
      return false;
    } catch {
      return false;
    }
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
        favorites,
        favoriteSuggestions,
        packages,
        isLoading,
        logout,
        refreshData,
        refreshFavorites,
        refreshPackages,
        pausePackage,
        resumePackage,
        fetchPackageQuote,
        purchasePackage,
        cancelPackage,
        addFavorite,
        removeFavorite,
        dismissSuggestion,
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
