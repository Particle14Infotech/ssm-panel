"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAdmin } from "@/context/AdminContext";
import { Ticket, TicketStatus, TicketPriority } from "@smm/contracts";
import {
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Send,
  User,
  ExternalLink,
  ShieldCheck,
  Filter,
  RefreshCw,
  Check,
  CornerDownRight,
  Sparkles,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";

const CANNED_REPLIES = [
  "We have initiated an automated refill request with the upstream provider. Please monitor delivery over the next 2-4 hours.",
  "Your payment reference has been verified and your wallet balance has been credited successfully. Thank you for your patience.",
  "The order queue is currently experiencing high volume from the network. It will resume processing shortly.",
  "Please ensure the target account profile is public and has no regional or age restrictions enabled.",
];

export default function AdminTicketsPage() {
  const { tickets, users, orders, replyTicketAdmin, updateTicketStatus, closeTicketAdmin } = useAdmin();

  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id || "");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filtered ticket queue
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status filter
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      // Priority filter
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesSubject = t.subject.toLowerCase().includes(q);
        const matchesOrderId = t.orderId ? t.orderId.toLowerCase().includes(q) : false;
        const matchesUserId = t.userId.toLowerCase().includes(q);
        const matchedUser = users.find((u) => u.id === t.userId);
        const matchesUserName = (matchedUser?.name || (t as any).userName || "").toLowerCase().includes(q);
        const matchesUserEmail = (matchedUser?.email || (t as any).userEmail || "").toLowerCase().includes(q);

        return matchesId || matchesSubject || matchesOrderId || matchesUserId || matchesUserName || matchesUserEmail;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery, users]);

  // Selected ticket
  const activeTicket = useMemo(() => {
    return tickets.find((t) => t.id === selectedTicketId) || filteredTickets[0] || tickets[0];
  }, [tickets, selectedTicketId, filteredTickets]);

  // Customer info for active ticket
  const activeCustomer = useMemo(() => {
    if (!activeTicket) return null;
    return users.find((u) => u.id === activeTicket.userId) || {
      id: activeTicket.userId,
      name: (activeTicket as any).userName || "Customer Account",
      email: (activeTicket as any).userEmail || `${activeTicket.userId.substring(0, 8)}@customer.internal`,
      balance: 0,
      tier: "STARTER" as const,
    };
  }, [activeTicket, users]);

  // Linked order info if any
  const linkedOrder = useMemo(() => {
    if (!activeTicket?.orderId) return null;
    return orders.find((o) => o.id === activeTicket.orderId);
  }, [activeTicket, orders]);

  // Stats calculation
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "CUSTOMER_REPLY").length;
  const inReviewCount = tickets.filter((t) => t.status === "IN_REVIEW").length;
  const criticalCount = tickets.filter((t) => t.priority === "CRITICAL" || t.priority === "HIGH").length;

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !activeTicket || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      const ok = await replyTicketAdmin(activeTicket.id, replyText.trim());
      if (ok) {
        setReplyText("");
        setActionSuccess("Reply dispatched successfully!");
        setTimeout(() => setActionSuccess(null), 3000);
      }
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!activeTicket) return;
    const ok = await updateTicketStatus(activeTicket.id, newStatus);
    if (ok) {
      setActionSuccess(`Ticket marked as ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    const ok = await closeTicketAdmin(activeTicket.id);
    if (ok) {
      setActionSuccess("Ticket closed.");
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <div className="w-full bg-transparent min-h-screen pb-24 text-slate-100">
      <div className="max-w-[1560px] mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Header Telemetry */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#D8EC8D]">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="uppercase tracking-widest font-semibold">
                Customer Support Dispatch & Incident Ledger
              </span>
            </div>
            <h1 className="text-3xl font-light text-white tracking-tight">Support Tickets Matrix</h1>
            <p className="text-xs text-slate-400">
              Direct response terminal for client escalations, order inquiries, and transaction reconciliations.
            </p>
          </div>

          {actionSuccess && (
            <div className="px-4 py-2 rounded-full bg-[#D8EC8D]/15 border border-[#D8EC8D]/40 text-[#D8EC8D] text-xs font-mono flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-3xl bg-[#1a1a1a]/70 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-medium">Total Tickets</span>
              <Inbox className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Lifetime platform tickets</div>
          </div>

          <div className="p-4 rounded-3xl bg-[#1a1a1a]/70 border border-emerald-500/20 backdrop-blur-md">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-xs font-medium">Pending Response</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 font-mono">{openCount}</div>
            <div className="text-[11px] text-emerald-400/70 mt-0.5">Needs admin action</div>
          </div>

          <div className="p-4 rounded-3xl bg-[#1a1a1a]/70 border border-amber-500/20 backdrop-blur-md">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-xs font-medium">In Investigation</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">{inReviewCount}</div>
            <div className="text-[11px] text-amber-400/70 mt-0.5">Under manual review</div>
          </div>

          <div className="p-4 rounded-3xl bg-[#1a1a1a]/70 border border-rose-500/20 backdrop-blur-md">
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-xs font-medium">High / Critical</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-300 font-mono">{criticalCount}</div>
            <div className="text-[11px] text-rose-400/70 mt-0.5">Priority escalations</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-2xl bg-[#161616]/80 border border-white/10 backdrop-blur-md">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
            {["ALL", "OPEN", "IN_REVIEW", "ANSWERED", "CLOSED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? "btn-primary-gradient text-[#171e00] font-bold shadow-[0_0_12px_rgba(216,236,141,0.25)]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {st === "ALL" ? "All Queue" : st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Priority Filter + Search Bar */}
          <div className="flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#202020] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#D8EC8D]"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ticket, order, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#202020] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D]"
              />
            </div>
          </div>
        </div>

        {/* Master-Detail 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Ticket List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono text-slate-400">
                DISPLAYING {filteredTickets.length} OF {tickets.length} TICKETS
              </span>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="p-8 rounded-3xl bg-[#1a1a1a]/70 border border-white/10 text-center">
                <EmptyState
                  title="No matching tickets"
                  description="Adjust your search query or status filter to see other support tickets."
                  icon={Inbox}
                />
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
                {filteredTickets.map((t) => {
                  const isSelected = activeTicket?.id === t.id;
                  const customer = users.find((u) => u.id === t.userId);
                  const lastMsg = t.messages[t.messages.length - 1];

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-[#222222] border-[#D8EC8D] shadow-[0_0_20px_rgba(216,236,141,0.15)] ring-1 ring-[#D8EC8D]/30"
                          : "bg-[#181818]/80 hover:bg-[#1e1e1e] border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white">{t.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              t.priority === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : t.priority === "HIGH"
                                ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                                : t.priority === "MEDIUM"
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <StatusBadge status={t.status} />
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 line-clamp-1 mb-1">{t.subject}</h3>

                      {lastMsg && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-2 font-sans">{lastMsg.content}</p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-300">{customer?.name || (t as any).userName || t.userId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{new Date(t.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Ticket Resolution Matrix & Chat (7 cols) */}
          <div className="lg:col-span-7">
            {activeTicket ? (
              <div className="p-6 rounded-3xl bg-[#1a1a1a]/90 border border-white/10 backdrop-blur-xl space-y-6">
                {/* Active Ticket Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-[#D8EC8D]">{activeTicket.id}</span>
                      <span className="text-white/20">•</span>
                      <span className="text-xs text-slate-400 font-mono">
                        Dept: {activeTicket.department.replace("_", " ")}
                      </span>
                      {activeTicket.orderId && (
                        <>
                          <span className="text-white/20">•</span>
                          <Link
                            href={`/admin/orders`}
                            className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <span>#{activeTicket.orderId}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight">{activeTicket.subject}</h2>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={activeTicket.status} />
                  </div>
                </div>

                {/* Customer Details Ribbon */}
                {activeCustomer && (
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl btn-primary-gradient text-[#171e00] flex items-center justify-center font-bold text-xs">
                        {activeCustomer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{activeCustomer.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{activeCustomer.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 font-mono text-xs">
                      <div>
                        <span className="text-slate-500">Tier: </span>
                        <span className="text-slate-200 font-bold">{activeCustomer.tier}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Wallet: </span>
                        <span className="text-[#D8EC8D] font-bold">₹{activeCustomer.balance.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Quick Actions Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">ADMIN WORKFLOW:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusChange("IN_REVIEW")}
                      className={`px-3 py-1 rounded-lg border transition-all ${
                        activeTicket.status === "IN_REVIEW"
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Investigating
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange("ANSWERED")}
                      className={`px-3 py-1 rounded-lg border transition-all ${
                        activeTicket.status === "ANSWERED"
                          ? "bg-sky-500/20 border-sky-500 text-sky-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Answered
                    </button>
                    {activeTicket.status !== "CLOSED" ? (
                      <button
                        type="button"
                        onClick={handleCloseTicket}
                        className="px-3 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all font-semibold"
                      >
                        Close Ticket
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChange("OPEN")}
                        className="px-3 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-all font-semibold"
                      >
                        Re-Open
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Message Thread */}
                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                  {activeTicket.messages.map((m) => {
                    const isAdmin = m.authorRole === "ADMIN" || m.authorId === "admin";

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-[11px]">
                          <span className={`font-semibold ${isAdmin ? "text-[#D8EC8D]" : "text-slate-300"}`}>
                            {isAdmin ? "Root Admin (Support)" : m.authorName || "Customer"}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div
                          className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${
                            isAdmin
                              ? "bg-[#D8EC8D]/15 border border-[#D8EC8D]/30 text-white rounded-tr-none"
                              : "bg-[#252525] border border-white/10 text-slate-200 rounded-tl-none"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Canned Quick Response Chips */}
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-[#D8EC8D]" />
                    <span>CANNED TEMPLATES (CLICK TO INSERT):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CANNED_REPLIES.map((canned, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyText(canned)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 text-left line-clamp-1 max-w-[280px] transition-all"
                      >
                        {canned}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="space-y-3">
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type official response to customer as Root Administrator..."
                      className="w-full bg-[#121212] border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D8EC8D] resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Dispatched with Root Admin credentials directly to user portal.
                    </span>

                    <button
                      type="submit"
                      disabled={isSubmittingReply || !replyText.trim()}
                      className="px-5 py-2.5 rounded-xl btn-primary-gradient text-[#171e00] text-xs font-bold shadow-[0_0_15px_rgba(216,236,141,0.25)] flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingReply ? "Dispatching..." : "Send Reply"}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="p-12 rounded-3xl bg-[#1a1a1a]/70 border border-white/10 text-center">
                <EmptyState
                  title="No ticket selected"
                  description="Select a ticket from the left panel to review telemetry and dispatch replies."
                  icon={MessageSquare}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
