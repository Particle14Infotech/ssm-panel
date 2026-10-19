"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomer } from "@/context/CustomerContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import {
  Bookmark,
  Sparkles,
  ArrowRight,
  Trash2,
  PlusCircle,
  ExternalLink,
  Clock,
  Repeat,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { formatIndianNumber } from "@/lib/numberFormat";

export default function FavoritesPage() {
  const router = useRouter();
  const {
    favorites,
    favoriteSuggestions,
    removeFavorite,
    addFavorite,
    dismissSuggestion,
    isLoading,
  } = useCustomer();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingSuggestionKey, setSavingSuggestionKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteFavorite = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your favorites?`)) {
      return;
    }
    setDeletingId(id);
    const res = await removeFavorite(id);
    setDeletingId(null);
    if (res.success) {
      showNotification("Favorite removed successfully.");
    } else {
      showNotification(res.error || "Failed to remove favorite.", "error");
    }
  };

  const handleSaveSuggestion = async (sug: any) => {
    const key = `${sug.serviceId}_${sug.targetUrl}`;
    setSavingSuggestionKey(key);
    const res = await addFavorite({
      serviceId: sug.serviceId,
      targetUrl: sug.targetUrl,
      defaultQuantity: sug.avgQuantity || 1000,
      customName: sug.serviceName,
    });
    setSavingSuggestionKey(null);
    if (res.success) {
      showNotification(`Saved "${sug.serviceName}" to your favorites!`);
    } else {
      showNotification(res.error || "Failed to save suggestion.", "error");
    }
  };

  const handleDismissSuggestion = async (serviceId: string, targetUrl: string) => {
    await dismissSuggestion(serviceId, targetUrl);
  };

  const handleReorder = (favId: string) => {
    router.push(`/new-order?favoriteId=${favId}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
            notification.type === "success"
              ? "bg-[#171e00]/95 border-[#D8EC8D]/40 text-[#D8EC8D]"
              : "bg-red-950/95 border-red-500/40 text-red-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 flex items-center justify-center text-[#D8EC8D]">
              <Bookmark className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Saved Favorites</h1>
          </div>
          <p className="text-sm text-slate-400">
            One-click reorder templates for your high-frequency links and campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
            {favorites.length} / 50 saved
          </div>
          <Link
            href="/new-order"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-sm hover:brightness-105 transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Order</span>
          </Link>
        </div>
      </div>

      {/* Smart Suggestions from Recent 90 Days */}
      {favoriteSuggestions.length > 0 && (
        <section aria-labelledby="suggestions-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D8EC8D]" />
            <h2 id="suggestions-heading" className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Frequently Reordered (Past 90 Days)
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteSuggestions.map((sug) => {
              const key = `${sug.serviceId}_${sug.targetUrl}`;
              const isSaving = savingSuggestionKey === key;
              return (
                <GlassCard
                  key={key}
                  className="p-4 rounded-2xl border-white/10 flex flex-col justify-between relative overflow-hidden bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => handleDismissSuggestion(sug.serviceId, sug.targetUrl)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 p-1 rounded-lg transition-colors"
                    title="Dismiss suggestion"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="space-y-2 pr-6">
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={sug.platform} size={18} />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Ordered {sug.orderCount} times
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white line-clamp-1">
                      {sug.serviceName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate" title={sug.targetUrl}>
                      {sug.targetUrl}
                    </div>
                    <div className="text-xs text-slate-400">
                      Typical qty:{" "}
                      <span className="font-mono text-[#D8EC8D] font-semibold">
                        {formatIndianNumber(sug.avgQuantity)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveSuggestion(sug)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D8EC8D] hover:underline"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isSaving ? "Saving..." : "Save to Favorites"}</span>
                    </button>
                    <Link
                      href={`/new-order?service=${sug.serviceId}&target=${encodeURIComponent(sug.targetUrl)}&quantity=${sug.avgQuantity}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                    >
                      <span>Order</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}

      {/* Favorites List */}
      <section aria-labelledby="favorites-grid-heading" className="space-y-4">
        <h2 id="favorites-grid-heading" className="sr-only">
          All Favorites
        </h2>

        {favorites.length === 0 ? (
          <GlassCard className="p-12 rounded-3xl border-white/10 text-center space-y-4 bg-white/[0.02]">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
              <Bookmark className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-lg font-semibold text-white">No favorites saved yet</h3>
              <p className="text-sm text-slate-400">
                Save your frequently ordered targets from your Orders history or New Order screen to reorder with a single click.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/new-order"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-sm hover:brightness-105 transition-all shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Go to New Order</span>
              </Link>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {favorites.map((fav) => {
              const displayName = fav.customName || fav.service?.displayName || fav.service?.name || "Service Template";
              const isServiceActive = fav.service?.status === "ACTIVE";
              const isDeleting = deletingId === fav.id;

              return (
                <GlassCard
                  key={fav.id}
                  className="p-5 rounded-2xl border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all bg-white/[0.02]"
                >
                  <div className="space-y-3">
                    {/* Top Row: Platform & Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {fav.service?.platform && <PlatformIcon platform={fav.service.platform} size={20} />}
                        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                          {fav.service?.platform || "PLATFORM"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isServiceActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            OFFLINE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <div className="text-base font-semibold text-white line-clamp-1" title={displayName}>
                        {displayName}
                      </div>
                      {fav.customName && fav.service?.name && (
                        <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {fav.service.displayName || fav.service.name}
                        </div>
                      )}
                    </div>

                    {/* Target link */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                        Target Link / Handle
                      </div>
                      <div className="text-xs text-slate-200 font-mono truncate flex items-center justify-between gap-2">
                        <span className="truncate">{fav.targetUrl}</span>
                        <a
                          href={fav.targetUrl.startsWith("http") ? fav.targetUrl : `https://${fav.targetUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-500 hover:text-slate-300 shrink-0"
                          title="Open link in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Specs / Configuration */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] uppercase font-mono text-slate-500">Quantity</div>
                        <div className="font-mono text-white font-semibold mt-0.5">
                          {formatIndianNumber(fav.defaultQuantity)}
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-[10px] uppercase font-mono text-slate-500">Current Rate</div>
                        <div className="font-mono text-[#D8EC8D] font-semibold mt-0.5">
                          {fav.service?.ratePer1000 ? `₹${fav.service.ratePer1000.toFixed(2)}/1k` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Drip-feed badge if set */}
                    {fav.isDripFeed && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-mono">
                        <Clock className="w-3 h-3" />
                        <span>
                          Drip: {fav.dripRuns || 5} runs every {fav.dripInterval || 60}m
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDeleteFavorite(fav.id, displayName)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Favorite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReorder(fav.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#D8EC8D] text-[#131313] font-semibold text-xs hover:brightness-105 transition-all shadow-sm"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>Use / Reorder</span>
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
