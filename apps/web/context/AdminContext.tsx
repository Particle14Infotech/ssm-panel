"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ServiceItem, OrderItem, TransactionItem } from "@smm/contracts";
import {
  AdminUser,
  AdminProvider,
  AdminCoupon,
  INITIAL_ADMIN_USERS,
  INITIAL_ADMIN_PROVIDERS,
  INITIAL_ADMIN_COUPONS,
} from "@/content/admin-data";

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
  addService: (service: ServiceItem) => void;
  updateService: (id: string, updates: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;
  updateOrderStatus: (orderId: string, status: any) => Promise<boolean>;
  resendOrderToProvider: (orderId: string) => Promise<boolean>;
  addProvider: (provider: AdminProvider) => void;
  syncProvider: (providerId: string) => Promise<boolean>;
  addCoupon: (coupon: AdminCoupon) => void;
  toggleCoupon: (couponId: string) => void;
  approvePayment: (txnId: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export function AdminProviderWrapper({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_ADMIN_USERS);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [providers, setProviders] = useState<AdminProvider[]>(INITIAL_ADMIN_PROVIDERS);
  const [coupons, setCoupons] = useState<AdminCoupon[]>(INITIAL_ADMIN_COUPONS);
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

      if (servicesRes.ok) {
        const rawServices = await servicesRes.json();
        if (Array.isArray(rawServices)) {
          setServices(
            rawServices.map((s: any) => ({
              id: s.id,
              categoryId: s.categoryId || "general",
              categoryName: s.category?.name || "General",
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
              apiKey: "••••••••",
              balance: Number(p.balance || 0),
              currency: p.currency || "USD",
              status: p.status === "ACTIVE" ? "CONNECTED" : "ERROR",
              serviceCount: p.serviceCount || 0,
              lastSyncAt: p.lastSyncAt || new Date().toISOString(),
            }))
          );
        }
      }
    } catch {
      // Keep state resilient
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

  const addService = (service: ServiceItem) => {
    setServices((prev) => [service, ...prev]);
  };

  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
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

  const addProvider = (provider: AdminProvider) => {
    setProviders((prev) => [provider, ...prev]);
  };

  const syncProvider = async () => true;

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
