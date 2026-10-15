"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  UserProfile,
  OrderItem,
  ServiceItem,
  TransactionItem,
  Ticket,
  CreateTicketInput,
  OrderStatus,
  canTransition,
  assertValidTransition,
  calculateOrderCharge,
  calculatePartialRefund,
  calculateDepositBonus,
  PaymentMethod,
  PaymentGatewaySession,
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

// Set to track used idempotency keys
const processedIdempotencyKeys = new Set<string>();

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

  const [pendingSessions, setPendingSessions] = useState<Record<string, PaymentGatewaySession>>({});

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
    couponCode?: string;
    idempotencyKey?: string;
  }) => {
    // 1. Idempotency Check
    if (input.idempotencyKey && processedIdempotencyKeys.has(input.idempotencyKey)) {
      const existing = orders.find((o) => o.idempotencyKey === input.idempotencyKey);
      if (existing) {
        return { success: true, orderId: existing.id };
      }
    }

    // 2. Validate Service
    const service = services.find((s) => s.id === input.serviceId);
    if (!service) {
      return { success: false, error: "Selected service does not exist." };
    }

    // 3. Validate Quantity
    if (input.quantity < service.minQty || input.quantity > service.maxQty) {
      return {
        success: false,
        error: `Quantity must be between ${service.minQty.toLocaleString()} and ${service.maxQty.toLocaleString()}.`,
      };
    }

    // 4. Calculate Authoritative Price
    const totalCost = calculateOrderCharge(service.ratePer1000, input.quantity);

    // 5. Validate Balance
    if (user.balance < totalCost) {
      return {
        success: false,
        error: `Insufficient balance (₹${user.balance.toFixed(2)}). Total required: ₹${totalCost.toFixed(2)}. Please add funds to proceed.`,
      };
    }

    if (input.idempotencyKey) {
      processedIdempotencyKeys.add(input.idempotencyKey);
    }

    // 6. Debit Wallet & Add Transaction Ledger Entry
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
      status: "PENDING",
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refillable: service.refillable,
      cancellable: service.cancellable,
    };

    const newTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount: -totalCost,
      bonus: 0,
      method: "CARD",
      status: "SUCCESS",
      referenceId: newOrderId,
      createdAt: new Date().toISOString(),
    };

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance - totalCost).toFixed(2)),
      totalSpent: Number((prev.totalSpent + totalCost).toFixed(2)),
      totalOrders: prev.totalOrders + 1,
    }));

    setTransactions((prev) => [newTxn, ...prev]);
    setOrders((prev) => [newOrder, ...prev]);

    // 7. Progression pipeline: PENDING -> PROCESSING -> IN_PROGRESS -> COMPLETED
    setTimeout(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === newOrderId && canTransition(o.status, "PROCESSING")) {
            return { ...o, status: "PROCESSING", updatedAt: new Date().toISOString() };
          }
          return o;
        })
      );
    }, 400);

    setTimeout(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === newOrderId && canTransition(o.status, "IN_PROGRESS")) {
            return {
              ...o,
              status: "IN_PROGRESS",
              remains: Math.floor(o.quantity * 0.4),
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        })
      );
    }, 1200);

    setTimeout(() => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id === newOrderId && canTransition(o.status, "COMPLETED")) {
            return {
              ...o,
              status: "COMPLETED",
              remains: 0,
              updatedAt: new Date().toISOString(),
            };
          }
          return o;
        })
      );
    }, 2400);

    return { success: true, orderId: newOrderId };
  };

  const cancelOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder || !targetOrder.cancellable) return false;

    // Enforce transition: PENDING/PROCESSING/IN_PROGRESS -> CANCELLED -> REFUNDED
    assertValidTransition(targetOrder.status, "CANCELLED");

    // Full refund to wallet
    const refundAmount = targetOrder.charge;

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + refundAmount).toFixed(2)),
    }));

    const refundTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount: refundAmount,
      bonus: 0,
      method: "CARD",
      status: "SUCCESS",
      referenceId: `REFUND-${orderId}`,
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [refundTxn, ...prev]);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "REFUNDED",
              cancellable: false,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    return true;
  };

  const processPartialOrder = async (orderId: string, remains: number) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return false;

    assertValidTransition(targetOrder.status, "PARTIAL");

    // Partial refund formula: refund = charge x (remains / quantity)
    const refundAmount = calculatePartialRefund(targetOrder.charge, targetOrder.quantity, remains);

    if (refundAmount > 0) {
      setUser((prev) => ({
        ...prev,
        balance: Number((prev.balance + refundAmount).toFixed(2)),
      }));

      const refundTxn: TransactionItem = {
        id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        userId: user.id,
        amount: refundAmount,
        bonus: 0,
        method: "CARD",
        status: "SUCCESS",
        referenceId: `PARTIAL-REFUND-${orderId}`,
        createdAt: new Date().toISOString(),
      };
      setTransactions((prev) => [refundTxn, ...prev]);
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "REFUNDED",
              remains,
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );

    return true;
  };

  const processFailedOrder = async (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return false;

    assertValidTransition(targetOrder.status, "FAILED");

    const refundAmount = targetOrder.charge;
    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + refundAmount).toFixed(2)),
    }));

    const refundTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount: refundAmount,
      bonus: 0,
      method: "CARD",
      status: "SUCCESS",
      referenceId: `FAILED-REFUND-${orderId}`,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [refundTxn, ...prev]);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "REFUNDED",
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

  const initiateDeposit = async (input: {
    amount: number;
    method: PaymentMethod;
    couponCode?: string;
    idempotencyKey?: string;
  }): Promise<PaymentGatewaySession> => {
    const { bonusAmount, totalCredit } = calculateDepositBonus(input.amount);
    const referenceId = `DEP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const session: PaymentGatewaySession = {
      sessionId: `sess_${Date.now()}`,
      referenceId,
      redirectUrl: `/app/wallet/verify?ref=${referenceId}`,
      amount: input.amount,
      bonusAmount,
      totalCredit,
      method: input.method,
      status: "PENDING",
    };

    setPendingSessions((prev) => ({ ...prev, [referenceId]: session }));
    return session;
  };

  const verifyDeposit = async (referenceId: string) => {
    const session = pendingSessions[referenceId];
    if (!session) {
      // Fallback auto session
      const amount = 1000;
      const { bonusAmount, totalCredit } = calculateDepositBonus(amount);
      const fallbackSession: PaymentGatewaySession = {
        sessionId: `sess_${Date.now()}`,
        referenceId,
        redirectUrl: `/app/wallet/verify?ref=${referenceId}`,
        amount,
        bonusAmount,
        totalCredit,
        method: "UPI",
        status: "SUCCESS",
      };

      const newTxn: TransactionItem = {
        id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        userId: user.id,
        amount,
        bonus: bonusAmount,
        method: "UPI",
        status: "SUCCESS",
        referenceId,
        createdAt: new Date().toISOString(),
      };

      setUser((prev) => ({
        ...prev,
        balance: Number((prev.balance + totalCredit).toFixed(2)),
      }));

      setTransactions((prev) => [newTxn, ...prev]);
      return { success: true, session: fallbackSession };
    }

    if (session.status === "SUCCESS") {
      return { success: true, session };
    }

    const completedSession: PaymentGatewaySession = {
      ...session,
      status: "SUCCESS",
    };

    const newTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount: session.amount,
      bonus: session.bonusAmount,
      method: session.method,
      status: "SUCCESS",
      referenceId,
      createdAt: new Date().toISOString(),
    };

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + session.totalCredit).toFixed(2)),
    }));

    setTransactions((prev) => [newTxn, ...prev]);
    setPendingSessions((prev) => ({ ...prev, [referenceId]: completedSession }));

    return { success: true, session: completedSession };
  };

  const depositFunds = async (amount: number, method: PaymentMethod) => {
    const { bonusAmount, totalCredit } = calculateDepositBonus(amount);
    const referenceId = `DEP-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const newTxn: TransactionItem = {
      id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.id,
      amount,
      bonus: bonusAmount,
      method,
      status: "SUCCESS",
      referenceId,
      createdAt: new Date().toISOString(),
    };

    setUser((prev) => ({
      ...prev,
      balance: Number((prev.balance + totalCredit).toFixed(2)),
    }));

    setTransactions((prev) => [newTxn, ...prev]);

    return { success: true, bonus: bonusAmount, total: totalCredit };
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
