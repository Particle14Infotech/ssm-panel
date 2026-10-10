"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserProfile,
  OrderItem,
  ServiceItem,
  TransactionItem,
  Ticket,
  CreateTicketInput,
} from "@smm/contracts";
import {
  INITIAL_USER,
  INITIAL_SERVICES,
  INITIAL_ORDERS,
  INITIAL_TRANSACTIONS,
  INITIAL_TICKETS,
} from "@/content/customer-data";

interface CustomerContextType {
  user: UserProfile;
  orders: OrderItem[];
  services: ServiceItem[];
  transactions: TransactionItem[];
  tickets: Ticket[];
  createOrder: (input: {
    serviceId: string;
    target: string;
    quantity: number;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
  }) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  refillOrder: (orderId: string) => Promise<boolean>;
  depositFunds: (amount: number, method: string) => Promise<{ success: boolean; bonus: number; total: number }>;
  createTicket: (input: CreateTicketInput) => Promise<{ success: boolean; ticketId?: string }>;
  replyTicket: (ticketId: string, message: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  regenerateApiKey: () => string;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_user");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_USER;
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

  const [services] = useState<ServiceItem[]>(INITIAL_SERVICES);

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

  const [tickets, setTickets] = useState<Ticket[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aether_tickets");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return INITIAL_TICKETS;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_user", JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_orders", JSON.stringify(orders));
    }
  }, [orders]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_transactions", JSON.stringify(transactions));
    }
  }, [transactions]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aether_tickets", JSON.stringify(tickets));
    }
  }, [tickets]);

  const createOrder = async (input: {
    serviceId: string;
    target: string;
    quantity: number;
    dripFeed?: boolean;
    runs?: number;
    interval?: number;
    comments?: string;
  }) => {
    const service = services.find((s) => s.id === input.serviceId);
    if (!service) {
      return { success: false, error: "Selected service does not exist." };
    }

    const totalCost = Number(((input.quantity / 1000) * service.ratePer1000).toFixed(2));
    if (user.balance < totalCost) {
      return {
        success: false,
        error: `Insufficient balance (₹${user.balance.toFixed(2)}). Total required: ₹${totalCost.toFixed(2)}. Please add funds to proceed.`,
      };
    }

    const newOrderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
    const newOrder: OrderItem = {
      id: newOrderId,
      userId: user.id,
      serviceId: service.id,
      serviceName: service.name,
      platform: service.platform.toLowerCase(),
      target: input.target,
      quantity: input.quantity,
      charge: totalCost,
      startCount: Math.floor(500 + Math.random() * 5000),
      remains: input.quantity,
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refillable: service.refillable,
      cancellable: service.cancellable,
    };

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance - totalCost).toFixed(2)),
      totalSpent: Number((prev.totalSpent + totalCost).toFixed(2)),
      totalOrders: prev.totalOrders + 1,
    }));

    setOrders((prev) => [newOrder, ...prev]);

    return { success: true, orderId: newOrderId };
  };

  const cancelOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || !targetOrder.cancellable) return false;

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + targetOrder.charge).toFixed(2)),
    }));

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "CANCELLED",
              cancellable: false,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    return true;
  };

  const refillOrder = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "IN_PROGRESS",
              remains: Math.max(0, Math.floor(o.quantity * 0.1)),
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
    return true;
  };

  const depositFunds = async (amount: number, method: string) => {
    let bonus = 0;
    if (amount >= 5000) bonus = amount * 0.15;
    else if (amount >= 1000) bonus = amount * 0.1;
    else if (amount >= 500) bonus = amount * 0.05;

    const totalAdded = amount + bonus;
    const newTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount,
      bonus,
      method,
      status: "SUCCESS",
      referenceId: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + totalAdded).toFixed(2)),
    }));

    setTransactions((prev) => [newTxn, ...prev]);

    return { success: true, bonus, total: totalAdded };
  };

  const createTicket = async (input: CreateTicketInput) => {
    const newTicketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: Ticket = {
      id: newTicketId,
      userId: user.id,
      subject: input.subject,
      department: input.department,
      priority: input.priority || "MEDIUM",
      status: "OPEN",
      orderId: input.orderId,
      lastReplyAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          ticketId: newTicketId,
          authorId: user.id,
          authorName: user.name,
          authorRole: "USER",
          content: input.message,
          attachments: input.attachments || [],
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setTickets((prev) => [newTicket, ...prev]);
    return { success: true, ticketId: newTicketId };
  };

  const replyTicket = async (ticketId: string, message: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === ticketId) {
          const userMsg = {
            id: `msg_${Date.now()}`,
            ticketId,
            authorId: user.id,
            authorName: user.name,
            authorRole: "USER" as const,
            content: message,
            attachments: [],
            createdAt: new Date().toISOString(),
          };
          return {
            ...t,
            status: "CUSTOMER_REPLY",
            lastReplyAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [...t.messages, userMsg],
          };
        }
        return t;
      })
    );
    return true;
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const regenerateApiKey = () => {
    const newKey = `aeth_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
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
        createOrder,
        cancelOrder,
        refillOrder,
        depositFunds,
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
