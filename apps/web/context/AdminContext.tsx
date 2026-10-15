"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ServiceItem, OrderItem, TransactionItem } from "@smm/contracts";
import { INITIAL_SERVICES, INITIAL_ORDERS, INITIAL_TRANSACTIONS } from "@/content/customer-data";
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
  updateUserBalance: (userId: string, newBalance: number) => void;
  adjustUserBalance: (userId: string, delta: number, reason?: string) => void;
  updateUserStatus: (userId: string, status: "ACTIVE" | "SUSPENDED" | "FLAGGED") => void;
  addService: (service: ServiceItem) => void;
  updateService: (id: string, updates: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;
  updateOrderStatus: (orderId: string, status: any) => void;
  resendOrderToProvider: (orderId: string) => Promise<boolean>;
  addProvider: (provider: AdminProvider) => void;
  syncProvider: (providerId: string) => Promise<boolean>;
  addCoupon: (coupon: AdminCoupon) => void;
  toggleCoupon: (couponId: string) => void;
  approvePayment: (txnId: string) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProviderWrapper({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AdminUser[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_admin_users");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_ADMIN_USERS;
  });

  const [services, setServices] = useState<ServiceItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_admin_services");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_SERVICES;
  });

  const [orders, setOrders] = useState<OrderItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_orders");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_ORDERS;
  });

  const [providers, setProviders] = useState<AdminProvider[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_admin_providers");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_ADMIN_PROVIDERS;
  });

  const [coupons, setCoupons] = useState<AdminCoupon[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_admin_coupons");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_ADMIN_COUPONS;
  });

  const [transactions, setTransactions] = useState<TransactionItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_transactions");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_admin_users", JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_admin_services", JSON.stringify(services));
    }
  }, [services]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_orders", JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_admin_providers", JSON.stringify(providers));
    }
  }, [providers]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_admin_coupons", JSON.stringify(coupons));
    }
  }, [coupons]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_transactions", JSON.stringify(transactions));
    }
  }, [transactions]);

  const updateUserBalance = (userId: string, newBalance: number) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, balance: newBalance } : u))
    );
  };

  const adjustUserBalance = (userId: string, delta: number, reason?: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newBal = Math.max(0, u.balance + delta);
          return { ...u, balance: newBal };
        }
        return u;
      })
    );
  };

  const updateUserStatus = (userId: string, status: "ACTIVE" | "SUSPENDED" | "FLAGGED") => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status } : u))
    );
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

  const updateOrderStatus = (orderId: string, status: any) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status,
              remains: status === "COMPLETED" ? 0 : o.remains,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
  };

  const resendOrderToProvider = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "PROCESSING", updatedAt: new Date().toISOString() }
          : o
      )
    );
    return true;
  };

  const addProvider = async (provider: AdminProvider) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const res = await fetch(`${apiBase}/providers/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: provider.name,
          apiUrl: provider.apiUrl,
          apiKey: provider.apiKey,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProviders((prev) => [
          {
            ...provider,
            id: data.id,
            apiKey: data.apiKeyMasked || "sk_live_••••••••",
            balance: data.balance || provider.balance,
          },
          ...prev,
        ]);
        return;
      }
    } catch (e) {
      console.warn("Falling back to local state for addProvider:", e);
    }
    setProviders((prev) => [provider, ...prev]);
  };

  const syncProvider = async (providerId: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
      const res = await fetch(`${apiBase}/providers/${providerId}/sync`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  status: "CONNECTED",
                  lastSyncAt: data.timestamp || new Date().toISOString(),
                  balance: data.balance ?? p.balance,
                }
              : p
          )
        );
        return true;
      }
    } catch (e) {
      console.warn("Falling back to local state for syncProvider:", e);
    }
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? {
              ...p,
              status: "CONNECTED",
              lastSyncAt: new Date().toISOString(),
              balance: Number((p.balance + Math.random() * 50).toFixed(2)),
            }
          : p
      )
    );
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

  return (
    <AdminContext.Provider
      value={{
        users,
        services,
        orders,
        providers,
        coupons,
        transactions,
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
