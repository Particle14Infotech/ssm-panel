"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ServiceItem, OrderItem, TransactionItem } from "@smm/contracts";
import { AdminUser, AdminProvider, AdminCoupon } from "@/content/admin-data";

interface AdminContextType {
  users: AdminUser[];
  services: ServiceItem[];
  orders: OrderItem[];
  providers: AdminProvider[];
  coupons: AdminCoupon[];
  transactions: TransactionItem[];
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
  syncProvider: (providerId: string) => Promise<boolean>;
  importFromProvider: (providerId: string, marginPercent?: number) => Promise<{ success: boolean; importedCount?: number }>;
  addCoupon: (coupon: AdminCoupon) => void;
  toggleCoupon: (couponId: string) => void;
  approvePayment: (txnId: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function AdminProviderWrapper({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getAuthToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
  }, []);

  const refreshAdminData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      setIsLoading(true);
      const [usersRes, ordersRes, servicesRes, providersRes] = await Promise.all([
        fetch(`${API_BASE}/users`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/orders`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/services`, { headers: authHeaders, cache: "no-store" }),
        fetch(`${API_BASE}/providers`, { headers: authHeaders, cache: "no-store" }).catch(() => null),
      ]);

      if (usersRes.ok) {
        const rawUsers = await usersRes.json();
        if (Array.isArray(rawUsers)) {
          setUsers(
            rawUsers.map((u: any) => ({
              id: u.id,
              name: u.name || "Customer",
              email: u.email,
              balance: u.wallet?.balance ? Number(u.wallet.balance) : 0,
              totalSpent: 0,
              totalOrders: 0,
              tier: (u.tier || "STARTER") as "STARTER" | "GROWTH" | "PRO_SCALE" | "ENTERPRISE",
              status: u.isDeleted ? "SUSPENDED" : "ACTIVE",
              createdAt: u.createdAt || new Date().toISOString(),
            }))
          );
        }
      }

      if (ordersRes.ok) {
        const rawOrders = await ordersRes.json();
        if (Array.isArray(rawOrders)) {
          setOrders(
            rawOrders.map((o: any) => ({
              id: o.id,
              userId: o.userId,
              serviceId: o.serviceId,
              serviceName: o.service?.name || "Service Item",
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

      if (servicesRes.ok) {
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

      if (providersRes && providersRes.ok) {
        const rawProviders = await providersRes.json();
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
              lastSyncAt: p.updatedAt || p.lastSyncAt || new Date().toISOString(),
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
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/providers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
    if (!token) return false;
    try {
      const res = await fetch(`${API_BASE}/providers/${providerId}/sync`, {
        method: "POST",
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

  const importFromProvider = async (providerId: string, marginPercent: number = 20) => {
    const token = getAuthToken();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/providers/${providerId}/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

  return (
    <AdminContext.Provider
      value={{
        users,
        services,
        orders,
        providers,
        coupons,
        transactions,
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
        syncProvider,
        importFromProvider,
        addCoupon,
        toggleCoupon,
        approvePayment,
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
