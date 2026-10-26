"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  ServiceItem,
  OrderItem,
  TransactionItem,
  Ticket,
  TicketMessage,
  TicketStatus,
  TicketPriority,
  TicketDepartment,
} from "@smm/contracts";
import {
  AdminUser,
  AdminProvider,
  AdminCoupon,
  INITIAL_ADMIN_PROVIDERS,
  INITIAL_ADMIN_TICKETS,
} from "@/content/admin-data";
import { getApiBase } from "@/lib/api-base";

interface AdminContextType {
  users: AdminUser[];
  services: ServiceItem[];
  orders: OrderItem[];
  providers: AdminProvider[];
  coupons: AdminCoupon[];
  transactions: TransactionItem[];
  tickets: Ticket[];
  isLoading: boolean;
  refreshAdminData: () => Promise<void>;
  updateUserBalance: (userId: string, newBalance: number) => void;
  adjustUserBalance: (userId: string, delta: number, reason?: string) => Promise<boolean>;
  updateUserStatus: (userId: string, status: "ACTIVE" | "SUSPENDED" | "FLAGGED") => Promise<boolean>;
  addService: (service: any) => Promise<boolean>;
  updateService: (id: string, updates: Partial<ServiceItem>) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: any) => Promise<boolean>;
  resendOrderToProvider: (orderId: string) => Promise<boolean>;
  addProvider: (provider: { name: string; apiUrl: string; apiKey: string }) => Promise<boolean>;
  updateProvider: (id: string, updates: { name?: string; apiUrl?: string; apiKey?: string; active?: boolean }) => Promise<boolean>;
  deleteProvider: (id: string) => Promise<boolean>;
  syncProvider: (providerId: string) => Promise<boolean>;
  importFromProvider: (providerId: string, marginPercent?: number) => Promise<{ success: boolean; importedCount?: number }>;
  applyBulkMargin: (params: { platform?: string; categoryId?: string; providerId?: string; marginPercent: number }) => Promise<{ success: boolean; count?: number; message?: string }>;
  addCoupon: (coupon: AdminCoupon) => void;
  toggleCoupon: (couponId: string) => void;
  approvePayment: (txnId: string) => void;
  replyTicketAdmin: (ticketId: string, message: string) => Promise<boolean>;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<boolean>;
  closeTicketAdmin: (ticketId: string) => Promise<boolean>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const API_BASE = getApiBase();

export function AdminProviderWrapper({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    const local = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (local) return local;
    const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);

  const refreshAdminData = useCallback(async () => {
    const token = getAuthToken();
    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      authHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      setIsLoading(true);
      const [servicesRes, providersRes, usersRes, ordersRes, ticketsRes] = await Promise.all([
        fetch(`${API_BASE}/services`, { cache: "no-store" }).catch(() => null),
        fetch(`${API_BASE}/providers`, { headers: authHeaders, cache: "no-store" }).catch(() => null),
        token ? fetch(`${API_BASE}/users`, { headers: authHeaders, cache: "no-store" }).catch(() => null) : null,
        token ? fetch(`${API_BASE}/orders`, { headers: authHeaders, cache: "no-store" }).catch(() => null) : null,
        token ? fetch(`${API_BASE}/tickets/admin/all`, { headers: authHeaders, cache: "no-store" }).catch(() => null) : null,
      ]);

      let mappedOrders: OrderItem[] = [];
      if (ordersRes && ordersRes.ok) {
        const rawOrders = await ordersRes.json();
        if (Array.isArray(rawOrders)) {
          mappedOrders = rawOrders.map((o: any) => ({
            id: o.id,
            userId: o.userId,
            userEmail: o.user?.email || o.userId,
            serviceId: o.serviceId,
            serviceName: o.service?.name || "Service Item",
            platform: (o.service?.platform || "general").toLowerCase(),
            target: o.target,
            quantity: o.quantity,
            charge: Number(o.charge),
            startCount: o.startCount ?? 0,
            remains: o.remains ?? 0,
            status: o.status,
            providerOrderId: o.providerOrderId || null,
            providerId: o.providerId || null,
            packageExecutionId: o.packageExecutionId || null,
            providerName: o.provider?.name || null,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            refillable: o.service?.refillable ?? false,
            cancellable: o.service?.cancellable ?? false,
            isDripFeed: o.isDripFeed ?? false,
            runs: o.runs ?? undefined,
            intervalMinutes: o.intervalMinutes ?? undefined,
            quantityPerRun: o.quantityPerRun ?? undefined,
            totalQuantity: o.totalQuantity ?? o.quantity,
            providerEvents: o.providerEvents ?? [],
          }));
          setOrders(mappedOrders);
        }
      }

      if (usersRes && usersRes.ok) {
        const rawUsers = await usersRes.json();
        if (Array.isArray(rawUsers)) {
          setUsers(
            rawUsers.map((u: any) => {
              const userOrders = mappedOrders.filter((o) => o.userId === u.id);
              const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.charge) || 0), 0);
              return {
                id: u.id,
                name: u.name || "Customer",
                email: u.email,
                balance: u.balance !== undefined ? Number(u.balance) : (u.wallet?.balance ? Number(u.wallet.balance) : 0),
                totalSpent: Number(totalSpent.toFixed(2)),
                totalOrders: userOrders.length,
                tier: (u.tier || "STARTER") as "STARTER" | "GROWTH" | "PRO_SCALE" | "ENTERPRISE",
                status: u.isDeleted ? "SUSPENDED" : "ACTIVE",
                createdAt: u.createdAt || new Date().toISOString(),
              };
            })
          );
        }
      }

      if (servicesRes && servicesRes.ok) {
        const rawServices = await servicesRes.json();
        if (Array.isArray(rawServices)) {
          setServices(
            rawServices.map((s: any) => ({
              id: s.id,
              categoryId: s.categoryId || "general",
              categoryName: s.categoryName || s.category?.name || "General",
              name: s.name,
              platform: s.platform,
              ratePer1000: Number(s.ratePer1000),
              providerCostPer1k: s.providerCostPer1k !== undefined && s.providerCostPer1k !== null ? Number(s.providerCostPer1k) : undefined,
              costINR: s.costINR !== undefined && s.costINR !== null ? Number(s.costINR) : undefined,
              marginPercent: s.marginPercent !== undefined && s.marginPercent !== null ? Number(s.marginPercent) : undefined,
              priceBelowCost: s.priceBelowCost ?? false,
              minQty: s.minQty,
              maxQty: s.maxQty,
              avgProcessingSpeed: "Instant",
              avgStartTime: "0 - 15 mins",
              refillable: s.refillable ?? true,
              cancellable: s.cancellable ?? true,
              description: s.description || "",
              status: s.status || "ACTIVE",
              providerId: s.providerId || null,
              providerServiceId: s.providerServiceId || null,
              providerName: s.providerName || (s.provider?.name ?? undefined),
              routingMode: s.routingMode || "MANUAL",
              backupProviderId: s.backupProviderId || null,
              backupProviderServiceId: s.backupProviderServiceId || null,
              backupProviderName: s.backupProviderName,
              dripFeedSupported: s.dripFeedSupported ?? false,
              allowManagedDrip: s.allowManagedDrip ?? (s.serviceType !== "CUSTOM_COMMENTS" && !s.name?.toLowerCase().includes("comment")),
              serviceType: s.serviceType || "DEFAULT",
              dripFeedMinRuns: s.dripFeedMinRuns ?? null,
              dripFeedMaxRuns: s.dripFeedMaxRuns ?? null,
              dripFeedMinInterval: s.dripFeedMinInterval ?? null,
              dripFeedMaxInterval: s.dripFeedMaxInterval ?? null,
            }))
          );
        }
      }

      let rawProviders: any = null;
      if (providersRes && providersRes.ok) {
        rawProviders = await providersRes.json().catch(() => null);
      }
      if (!Array.isArray(rawProviders)) {
        const localProvidersRes = await fetch("/api/providers", { cache: "no-store" }).catch(() => null);
        if (localProvidersRes && localProvidersRes.ok) {
          rawProviders = await localProvidersRes.json().catch(() => null);
        }
      }

      if (Array.isArray(rawProviders)) {
        setProviders(
          rawProviders.map((p: any) => ({
            id: p.id,
            name: p.name,
            apiUrl: p.apiUrl,
            apiKey: p.apiKeyMasked || "••••••••",
            balance: Number(p.balance || 0),
            currency: p.currency || "INR",
            status: p.active !== false ? "CONNECTED" : "ERROR",
            serviceCount: p.serviceCount || 0,
            healthStatus: p.healthStatus || "UNKNOWN",
            consecutiveStatusFailures: Number(p.consecutiveStatusFailures || 0),
            lastStatusCheckAt: p.lastStatusCheckAt || null,
            lastSyncAt: p.updatedAt || p.lastSyncAt || null,
          }))
        );
      }

      if (ticketsRes && ticketsRes.ok) {
        const rawTickets = await ticketsRes.json();
        if (Array.isArray(rawTickets)) {
          setTickets(
            rawTickets.map((tk: any) => ({
              id: tk.id,
              userId: tk.userId,
              userName: tk.user?.name || "Customer",
              userEmail: tk.user?.email || tk.userId,
              subject: tk.subject,
              department: (tk.department || "GENERAL_SUPPORT") as TicketDepartment,
              priority: (tk.priority === "HIGH" || tk.priority === "CRITICAL" || tk.priority === "LOW" ? tk.priority : "MEDIUM") as TicketPriority,
              status: (tk.status === "CLOSED" || tk.status === "RESOLVED" || tk.status === "ANSWERED" || tk.status === "IN_REVIEW" ? tk.status : "OPEN") as TicketStatus,
              orderId: tk.orderId,
              lastReplyAt: tk.updatedAt ? new Date(tk.updatedAt).toISOString() : new Date().toISOString(),
              createdAt: tk.createdAt ? new Date(tk.createdAt).toISOString() : new Date().toISOString(),
              updatedAt: tk.updatedAt ? new Date(tk.updatedAt).toISOString() : new Date().toISOString(),
              messages: Array.isArray(tk.messages)
                ? tk.messages.map((m: any) => ({
                    id: m.id,
                    ticketId: tk.id,
                    authorId: m.senderId,
                    authorName: m.senderId === "ADMIN" || m.senderId === "admin" ? "Support Staff" : (tk.user?.name || "Customer"),
                    authorRole: (m.senderId === "ADMIN" || m.senderId === "admin" ? "ADMIN" : "USER") as "USER" | "ADMIN",
                    content: m.message,
                    attachments: [],
                    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
                  }))
                : [],
            }))
          );
        }
      }
    } catch {
      // Resilient fallback
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    refreshAdminData();
  }, [refreshAdminData]);

  const updateUserBalance = (userId: string, newBalance: number) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, balance: newBalance } : u))
    );
  };

  const adjustUserBalance = async (userId: string, delta: number, reason: string = "Admin Adjustment") => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/wallet/adjust`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, amount: delta, reason }),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateUserStatus = async (userId: string, status: "ACTIVE" | "SUSPENDED" | "FLAGGED") => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const addService = async (service: any) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/services`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(service),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateService = async (id: string, updates: Partial<ServiceItem>) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/services/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteService = async (id: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const updateOrderStatus = async (orderId: string, status: any) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const resendOrderToProvider = async (orderId: string) => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/retry`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const addProvider = async (provider: { name: string; apiUrl: string; apiKey: string }) => {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/providers`, {
        method: "POST",
        headers,
        body: JSON.stringify(provider),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const syncProvider = async (providerId: string) => {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      let res = await fetch(`/api/providers/${providerId}/sync`, {
        method: "POST",
        headers,
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE}/providers/${providerId}/sync`, {
          method: "POST",
          headers,
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.balance === "number") {
          setProviders((prev) =>
            prev.map((p) =>
              p.id === providerId
                ? {
                    ...p,
                    balance: data.balance,
                    currency: data.currency || p.currency,
                    status: data.status === "CONNECTED" ? "CONNECTED" : p.status,
                    serviceCount: data.totalActiveServices ?? p.serviceCount,
                    lastSyncAt: data.timestamp || new Date().toISOString(),
                  }
                : p
            )
          );
        }
        await refreshAdminData();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const importFromProvider = async (providerId: string, marginPercent: number = 20) => {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/providers/${providerId}/import`, {
        method: "POST",
        headers,
        body: JSON.stringify({ marginPercent }),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshAdminData();
        return { success: true, importedCount: data.importedCount };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const applyBulkMargin = async (params: { platform?: string; categoryId?: string; providerId?: string; marginPercent: number }) => {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/admin/pricing/bulk-margin`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...params,
          previewOnly: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshAdminData();
        return {
          success: true,
          count: data.count || data.appliedCount,
          message: `Successfully applied +${params.marginPercent}% margin to ${data.count || data.appliedCount || 0} services.`,
        };
      }
      return { success: false, message: data.message || "Failed to apply bulk margin" };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const updateProvider = async (id: string, updates: { name?: string; apiUrl?: string; apiKey?: string; active?: boolean }) => {
    const token = getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/providers/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
    } catch {
      // Fallback below
    }

    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...(updates.name ? { name: updates.name } : {}),
              ...(updates.apiUrl ? { apiUrl: updates.apiUrl } : {}),
              ...(typeof updates.active === "boolean" ? { status: updates.active ? "CONNECTED" : "ERROR" } : {}),
            }
          : p
      )
    );
    return true;
  };

  const deleteProvider = async (id: string) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/providers/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        await refreshAdminData();
        return true;
      }
    } catch {
      // Fallback
    }

    setProviders((prev) => prev.filter((p) => p.id !== id));
    return true;
  };

  const addCoupon = (coupon: AdminCoupon) => {
    setCoupons((prev) => [coupon, ...prev]);
  };

  const toggleCoupon = (couponId: string) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === couponId ? { ...c, active: !c.active } : c))
    );
  };

  const approvePayment = (txnId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txnId ? { ...t, status: "SUCCESS" } : t))
    );
  };

  const replyTicketAdmin = async (ticketId: string, message: string): Promise<boolean> => {
    const token = getAuthToken();
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/reply`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        });
        if (res.ok) {
          await refreshAdminData();
          return true;
        }
      }
    } catch {}

    // Resilient fallback / optimistic update
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const newMsg: TicketMessage = {
            id: `msg_${Date.now()}`,
            ticketId,
            authorId: "admin",
            authorName: "Support Staff",
            authorRole: "ADMIN",
            content: message,
            attachments: [],
            createdAt: new Date().toISOString(),
          };
          return {
            ...t,
            status: "ANSWERED",
            updatedAt: new Date().toISOString(),
            lastReplyAt: new Date().toISOString(),
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      })
    );
    return true;
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus): Promise<boolean> => {
    const token = getAuthToken();
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/status`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          await refreshAdminData();
          return true;
        }
      }
    } catch {}

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t))
    );
    return true;
  };

  const closeTicketAdmin = async (ticketId: string): Promise<boolean> => {
    const token = getAuthToken();
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}/close`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          await refreshAdminData();
          return true;
        }
      }
    } catch {}

    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: "CLOSED", updatedAt: new Date().toISOString() } : t))
    );
    return true;
  };

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
    }
  }, []);

  return (
    <AdminContext.Provider
      value={{
        users,
        services,
        orders,
        providers,
        coupons,
        transactions,
        tickets,
        isLoading,
        refreshAdminData,
        updateUserBalance,
        adjustUserBalance,
        updateUserStatus,
        addService,
        updateService,
        deleteService,
        updateOrderStatus,
        resendOrderToProvider,
        addProvider,
        updateProvider,
        deleteProvider,
        syncProvider,
        importFromProvider,
        applyBulkMargin,
        addCoupon,
        toggleCoupon,
        approvePayment,
        replyTicketAdmin,
        updateTicketStatus,
        closeTicketAdmin,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within an AdminProviderWrapper");
  }
  return context;
}
