"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { Ticket, TicketDepartment, TicketPriority } from "@smm/contracts";
import {
  HelpCircle,
  PlusCircle,
  Search,
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
} from "lucide-react";

function SupportContent() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  const { tickets, createTicket, replyTicket, user } = useCustomer();

  const [selectedTicketId, setSelectedTicketId] = useState<string>(
    tickets[0]?.id || ""
  );
  const [isCreatingTicket, setIsCreatingTicket] = useState<boolean>(false);
  const [replyMessage, setReplyMessage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // New Ticket Form State
  const [subject, setSubject] = useState<string>("");
  const [department, setDepartment] = useState<TicketDepartment>(
    orderIdParam ? "ORDER_ISSUES" : "ORDER_ISSUES"
  );
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [orderId, setOrderId] = useState<string>(orderIdParam || "");
  const [initialMessage, setInitialMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (orderIdParam) {
      setOrderId(orderIdParam);
      setSubject(`Inquiry regarding Order ${orderIdParam}`);
      setIsCreatingTicket(true);
    }
  }, [orderIdParam]);

  const activeTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  const filteredTickets = tickets.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      q === "" ||
      t.id.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.department.toLowerCase().includes(q)
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (subject.trim().length < 5) {
      setFormError("Subject must be at least 5 characters.");
      return;
    }
    if (initialMessage.trim().length < 10) {
      setFormError("Message must be at least 10 characters.");
      return;
    }

    const res = await createTicket({
      subject,
      department,
      priority,
      orderId: orderId.trim() ? orderId.trim() : undefined,
      message: initialMessage,
    });

    if (res.success && res.ticketId) {
      setSelectedTicketId(res.ticketId);
      setIsCreatingTicket(false);
      setSubject("");
      setInitialMessage("");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    await replyTicket(activeTicket.id, replyMessage.trim());
    setReplyMessage("");
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header Telemetry */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#DBEF90]">
              <span className="w-2 h-2 rounded-full bg-[#DBEF90] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Customer Support & Telemetry Resolution Center
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Support Tickets</h1>
              <span className="text-[#DBEF90] text-3xl font-light leading-none">*</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              24/7 dedicated support daemon with automated vector diagnostics and fast human engineer routing.
            </p>
          </div>

          <button
            onClick={() => setIsCreatingTicket(true)}
            className="px-5 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 flex items-center gap-2 shadow-[0_0_20px_rgba(219,239,144,0.3)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Open New Ticket</span>
          </button>
        </div>

        {/* 2-Column Split: Ticket List (4 cols) and Chat Timeline (8 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Tickets Sidebar (4 cols) */}
          <div className="lg:col-span-4 glass-panel rounded-[2rem] p-4 md:p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className="w-full bg-surface-container-highest/80 border border-white/5 rounded-2xl pl-10 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredTickets.map((ticket) => {
                const isSelected = activeTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setIsCreatingTicket(false);
                    }}
                    className={`w-full p-4 rounded-2xl text-left border transition-all flex flex-col gap-2 ${
                      isSelected
                        ? "bg-[#d8ec8d]/10 border-[#DBEF90] shadow-[0_0_15px_rgba(219,239,144,0.15)]"
                        : "bg-surface-container-high/40 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-[#DBEF90]">
                        ✦ {ticket.id}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-semibold ${
                          ticket.status === "RESOLVED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : ticket.status === "ANSWERED"
                            ? "bg-[#DBEF90]/20 text-[#DBEF90]"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white truncate">{ticket.subject}</div>

                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-mono pt-1">
                      <span>{ticket.department}</span>
                      <span>{new Date(ticket.lastReplyAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Chat Timeline or Ticket Creator Form (8 cols) */}
          <div className="lg:col-span-8 glass-panel rounded-[2rem] p-6 md:p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)] space-y-6">
            {isCreatingTicket ? (
              /* Ticket Creation Form */
              <form onSubmit={handleCreateSubmit} className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-light text-white">Create New Support Ticket</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Submit order queries, refill warranty alerts, or custom API limits.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingTicket(false)}
                    className="text-xs text-on-surface-variant hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                    {formError}
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Order refill check for ORD-98421"
                      required
                      className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-3 text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                        Department
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value as TicketDepartment)}
                        className="w-full bg-surface-container-highest border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none font-medium cursor-pointer"
                      >
                        <option value="ORDER_ISSUES">Order Issues & Speed</option>
                        <option value="SERVICE_REFILL">Service Refill & Warranty</option>
                        <option value="PAYMENT_BILLING">Payment & Wallet Billing</option>
                        <option value="API_INTEGRATION">API & High-Frequency Bot</option>
                        <option value="GENERAL_SUPPORT">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                        Priority Level
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as TicketPriority)}
                        className="w-full bg-surface-container-highest border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none font-medium cursor-pointer"
                      >
                        <option value="LOW">Low (Standard 4h SLA)</option>
                        <option value="MEDIUM">Medium (1h SLA)</option>
                        <option value="HIGH">High Priority (15m SLA)</option>
                        <option value="CRITICAL">Critical Issue (Instant)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                      Related Order ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      placeholder="e.g. ORD-98421"
                      className="w-full bg-surface-container-highest border border-white/10 rounded-2xl px-4 py-2.5 text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-on-surface-variant font-mono font-semibold block mb-1">
                      Message Details
                    </label>
                    <textarea
                      rows={4}
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      placeholder="Please describe your query in detail..."
                      required
                      className="w-full bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl p-4 text-white focus:outline-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingTicket(false)}
                    className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-full bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 shadow-lg"
                  >
                    Submit Ticket
                  </button>
                </div>
              </form>
            ) : activeTicket ? (
              /* Active Ticket Chat Timeline */
              <div className="space-y-6">
                {/* Active Ticket Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#DBEF90]">
                        ✦ {activeTicket.id}
                      </span>
                      {activeTicket.orderId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white">
                          Order: {activeTicket.orderId}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-white mt-1">{activeTicket.subject}</h2>
                    <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                      Dept: {activeTicket.department} • Priority: {activeTicket.priority}
                    </div>
                  </div>

                  <span
                    className={`text-xs px-3 py-1 rounded-full font-mono uppercase font-semibold self-start sm:self-center ${
                      activeTicket.status === "RESOLVED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-[#DBEF90]/20 text-[#DBEF90]"
                    }`}
                  >
                    {activeTicket.status}
                  </span>
                </div>

                {/* Messages Feed */}
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
                  {activeTicket.messages.map((msg) => {
                    const isUser = msg.authorRole === "USER";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 text-xs ${
                          isUser ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isUser
                              ? "bg-[#DBEF90] text-[#2a3400]"
                              : "bg-surface-container-high text-white"
                          }`}
                        >
                          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-[#DBEF90]" />}
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl p-4 space-y-1.5 ${
                            isUser
                              ? "bg-[#DBEF90]/15 border border-[#DBEF90]/30 text-white rounded-tr-none"
                              : "bg-surface-container-high/80 border border-white/5 text-on-surface rounded-tl-none"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4 font-mono text-[10px] opacity-70">
                            <span className="font-bold">{msg.authorName}</span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fast Reply Box */}
                <form onSubmit={handleSendReply} className="pt-2 border-t border-white/10 flex items-center gap-3">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your response to support agent..."
                    className="flex-1 bg-surface-container-highest border border-white/10 focus:border-[#DBEF90] rounded-2xl px-4 py-3 text-xs text-white placeholder:text-white/30 focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!replyMessage.trim()}
                    className="px-5 py-3 rounded-2xl bg-[#DBEF90] text-[#2a3400] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md shrink-0"
                  >
                    <span>Reply</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="py-20 text-center text-on-surface-variant">
                No ticket selected. Click &quot;Open New Ticket&quot; to create one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center text-[#DBEF90] font-mono text-xs">
          ✦ Loading Support Telemetry...
        </div>
      }
    >
      <SupportContent />
    </Suspense>
  );
}
