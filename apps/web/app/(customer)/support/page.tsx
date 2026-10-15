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
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormField } from "@/components/shared/FormField";

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
    orderIdParam ? "ORDER_ISSUES" : "GENERAL_SUPPORT"
  );
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [orderId, setOrderId] = useState<string>(orderIdParam || "");
  const [initialMessage, setInitialMessage] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

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
      t.subject.toLowerCase().includes(q)
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

    setSubmitting(true);
    const res = await createTicket({
      subject,
      department,
      priority,
      orderId: orderId.trim() ? orderId.trim() : undefined,
      message: initialMessage,
    });
    setSubmitting(false);

    if (res.success && res.ticketId) {
      setSelectedTicketId(res.ticketId);
      setIsCreatingTicket(false);
      setSubject("");
      setInitialMessage("");
    } else {
      setFormError("Failed to create ticket. Please try again.");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket) return;

    await replyTicket(activeTicket.id, replyMessage.trim());
    setReplyMessage("");
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header Telemetry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="uppercase tracking-widest font-semibold">Support Desk</span>
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Support Tickets</h1>
          <p className="text-xs text-slate-400">
            Direct communication with support staff for order refills, balance issues, and inquiries.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingTicket(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Open New Ticket</span>
        </button>
      </div>

      {/* 2-Column Split: Ticket List (4 cols) and Chat / Form (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Tickets Sidebar (4 cols) */}
        <div className="lg:col-span-4 glass-panel p-4 md:p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredTickets.length === 0 ? (
              tickets.length === 0 ? (
                <EmptyState
                  icon={HelpCircle}
                  title="No tickets yet"
                  description="Have a question or issue? Open a support ticket to get help from our engineers."
                  actionText="Open ticket"
                  onActionClick={() => setIsCreatingTicket(true)}
                />
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 font-mono">
                  No tickets match the search query.
                </div>
              )
            ) : (
              filteredTickets.map((ticket) => {
                const isSelected = activeTicket?.id === ticket.id && !isCreatingTicket;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setIsCreatingTicket(false);
                    }}
                    className={`w-full p-4 rounded-2xl text-left border transition-all flex flex-col gap-2 ${
                      isSelected
                        ? "bg-blue-600/15 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold text-blue-400">
                        #{ticket.id}
                      </span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <div className="text-xs font-semibold text-white truncate">{ticket.subject}</div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{ticket.department}</span>
                      <span>{new Date(ticket.lastReplyAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Thread OR Create Form (8 cols) */}
        <div className="lg:col-span-8">
          {isCreatingTicket ? (
            <div className="glass-panel p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="space-y-0.5">
                  <h2 className="text-base font-semibold text-white">Create New Support Ticket</h2>
                  <p className="text-xs text-slate-400">Fill out details below for prompt resolution.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingTicket(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <FormField label="Subject" required>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Order #1042 refill request / Payment balance query"
                    required
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Department">
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value as TicketDepartment)}
                      className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-sans"
                    >
                      <option value="GENERAL_SUPPORT" className="bg-[#070B16]">General Support</option>
                      <option value="ORDER_ISSUES" className="bg-[#070B16]">Order Issues & Refills</option>
                      <option value="BILLING" className="bg-[#070B16]">Billing & Deposits</option>
                      <option value="API_INTEGRATION" className="bg-[#070B16]">API & Reseller Setup</option>
                    </select>
                  </FormField>

                  <FormField label="Order ID (Optional)">
                    <input
                      type="text"
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      placeholder="e.g. 1042 or ord_XXXXXX"
                      className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
                    />
                  </FormField>
                </div>

                <FormField label="Detailed Message" required>
                  <textarea
                    rows={5}
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    placeholder="Describe your issue or question in detail..."
                    required
                    className="w-full bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none resize-none"
                  />
                </FormField>

                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingTicket(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTicket ? (
            <div className="glass-panel p-6 md:p-8 space-y-6 flex flex-col h-full min-h-[560px]">
              {/* Ticket Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-blue-400">
                      #{activeTicket.id}
                    </span>
                    <StatusBadge status={activeTicket.status} />
                  </div>
                  <h2 className="text-lg font-semibold text-white">{activeTicket.subject}</h2>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div>Department: {activeTicket.department}</div>
                  <div>Opened: {new Date(activeTicket.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 space-y-4 overflow-y-auto max-h-[360px] pr-2">
                {activeTicket.messages.map((msg) => {
                  const isStaff = msg.authorRole === "ADMIN";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-1 ${
                          isStaff
                            ? "bg-white/[0.04] border border-white/10 text-slate-200"
                            : "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 font-mono text-[10px] opacity-75">
                          <span>{msg.authorName}</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="pt-2 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response to support staff..."
                  className="flex-1 bg-white/5 border border-white/10 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!replyMessage.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="glass-panel p-12 text-center space-y-3">
              <HelpCircle className="w-8 h-8 text-blue-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">Select a Ticket</h3>
              <p className="text-xs text-slate-400">Choose a ticket from the sidebar or open a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading support...</div>}>
      <SupportContent />
    </Suspense>
  );
}
