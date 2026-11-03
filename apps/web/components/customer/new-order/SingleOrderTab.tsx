"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { formatIndianNumber } from "@/lib/numberFormat";
import { validateServiceLink } from "@smm/contracts";
import { GenericSelect } from "./CustomDropdownSelect";
import {
  Search,
  ChevronDown,
  Info,
  Clock,
  ShieldCheck,
  Sparkles,
  Link2,
  Calendar,
  Star,
  Clipboard,
  AlertTriangle,
  History,
  X,
  Check,
} from "lucide-react";

interface SingleOrderTabProps {
  platform: string;
  categories: any[];
  services: any[];
  durationChips: number[];
  favorites: any[];
  recentOrders: any[];
  onOrderDetailsChange: (details: {
    service: any;
    targetUrl: string;
    quantity: number;
    ratePer1000: number;
    isDrip: boolean;
    dripRuns: number;
    dripIntervalHours: number;
    customComments?: string[];
    geoCountry?: string;
  }) => void;
  onSwitchTab?: (tab: string) => void;
  prefilledTargetUrl?: string;
  isLoading?: boolean;
}

export function SingleOrderTab({
  platform,
  categories,
  services,
  durationChips,
  favorites,
  recentOrders,
  onOrderDetailsChange,
  onSwitchTab,
  prefilledTargetUrl = "",
  isLoading = false,
}: SingleOrderTabProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState<boolean>(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [targetUrl, setTargetUrl] = useState<string>(prefilledTargetUrl);
  const [quantity, setQuantity] = useState<number>(1000);
  const [commentsText, setCommentsText] = useState<string>("");
  const [geoCountry, setGeoCountry] = useState<string>("");

  // Drip configuration
  const [isDripEnabled, setIsDripEnabled] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<number>(1);
  const [extraHours, setExtraHours] = useState<number>(0);

  // Prefill alert banner
  const [prefillSource, setPrefillSource] = useState<string | null>(null);

  // Reset category, search and service selection when platform changes
  useEffect(() => {
    setSelectedCategoryId("ALL");
    setSelectedServiceId("");
    setSearchQuery("");
    setCategorySearchQuery("");
    setIsCategoryDropdownOpen(false);
    setIsServiceDropdownOpen(false);
  }, [platform]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update target URL if prefill changes from external
  useEffect(() => {
    if (prefilledTargetUrl && !targetUrl) {
      setTargetUrl(prefilledTargetUrl);
    }
  }, [prefilledTargetUrl, targetUrl]);

  // Normalize services for the selected platform
  const platformServices = useMemo(() => {
    const platNorm = (platform || "instagram").toLowerCase().replace("x_twitter", "x");
    return services.filter((s) => {
      // If service specifies a platform, filter by it; otherwise it is pre-scoped by bootstrap
      if (s.platform) {
        const sPlat = s.platform.toLowerCase().replace("x_twitter", "x");
        return sPlat === platNorm || sPlat === "general" || sPlat === "all";
      }
      return true;
    });
  }, [services, platform]);

  // Categories list derived with active service counts (uncategorized grouped under 'Other')
  const categoryList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    platformServices.forEach((s) => {
      const catName = s.categoryName?.trim() || "Other";
      const catId = s.categoryId || catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const existing = map.get(catId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(catId, { id: catId, name: catName, count: 1 });
      }
    });

    const list = Array.from(map.values()).sort((a, b) => {
      if (a.name === "Other") return 1;
      if (b.name === "Other") return -1;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [platformServices]);

  // Filter categories by category search query
  const filteredCategoryList = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoryList;
    const q = categorySearchQuery.toLowerCase().trim();
    return categoryList.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [categoryList, categorySearchQuery]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === "ALL") return `All Categories (${platformServices.length})`;
    const match = categoryList.find((c) => c.id === selectedCategoryId);
    return match ? `${match.name} (${match.count})` : `All Categories (${platformServices.length})`;
  }, [selectedCategoryId, categoryList, platformServices.length]);

  // Filter services by category
  const categoryFilteredServices = useMemo(() => {
    if (selectedCategoryId === "ALL") return platformServices;
    return platformServices.filter((s) => {
      const catName = s.categoryName?.trim() || "Other";
      const catId = s.categoryId || catName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return catId === selectedCategoryId;
    });
  }, [platformServices, selectedCategoryId]);

  // Filter services by search query
  const eligibleServices = useMemo(() => {
    if (!searchQuery.trim()) return categoryFilteredServices;
    const q = searchQuery.toLowerCase().trim();
    return categoryFilteredServices.filter((s) => {
      const name = (s.displayName || s.name || "").toLowerCase();
      const cat = (s.categoryName || "").toLowerCase();
      const idStr = String(s.id).toLowerCase();
      return name.includes(q) || cat.includes(q) || idStr.includes(q);
    });
  }, [categoryFilteredServices, searchQuery]);

  // Set default service when platform or category changes
  useEffect(() => {
    if (categoryFilteredServices.length > 0) {
      const currentExists = categoryFilteredServices.some((s) => s.id === selectedServiceId);
      if (!currentExists) {
        const first = categoryFilteredServices[0];
        setSelectedServiceId(first.id);
        setQuantity(Math.max(first.minQty || 10, 1000));
      }
    }
  }, [categoryFilteredServices, selectedServiceId]);

  const selectedService = useMemo(() => {
    return (
      platformServices.find((s) => s.id === selectedServiceId) ||
      categoryFilteredServices[0] ||
      platformServices[0] ||
      null
    );
  }, [platformServices, selectedServiceId, categoryFilteredServices]);

  // Determine expected link type
  const linkType = useMemo(() => {
    if (selectedService?.linkType) return selectedService.linkType;
    const lower = (selectedService?.displayName || selectedService?.name || "").toLowerCase();
    if (lower.includes("follower") || lower.includes("subscriber") || lower.includes("member")) {
      return platform.toLowerCase() === "youtube" ? "CHANNEL" : "PROFILE";
    }
    return "POST_OR_REEL";
  }, [selectedService, platform]);

  const linkLabel = useMemo(() => {
    const p = platform.toLowerCase();
    switch (linkType) {
      case "PROFILE":
        if (p === "spotify") return "Artist / Profile link";
        if (p === "facebook") return "Page / Profile link";
        return "Profile link";
      case "CHANNEL":
        return p === "youtube" ? "Channel link" : "Channel / Group link";
      case "POST_OR_REEL":
        if (p === "youtube") return "Video link";
        if (p === "spotify") return "Track / Album / Playlist link";
        if (p === "facebook") return "Post / Video link";
        return "Post or reel link";
      default:
        return "Target link";
    }
  }, [linkType, platform]);

  const linkPlaceholder = useMemo(() => {
    const p = platform.toLowerCase();
    switch (p) {
      case "instagram":
        return linkType === "PROFILE" ? "https://instagram.com/username" : "https://instagram.com/reel/C0xyz...";
      case "youtube":
        return linkType === "CHANNEL" ? "https://youtube.com/@channel" : "https://youtube.com/watch?v=...";
      case "tiktok":
        return linkType === "PROFILE" ? "https://tiktok.com/@username" : "https://tiktok.com/@user/video/...";
      case "x":
        return linkType === "PROFILE" ? "https://x.com/username" : "https://x.com/user/status/...";
      case "telegram":
        return linkType === "CHANNEL" ? "https://t.me/channel" : "https://t.me/channel/123";
      case "facebook":
        return linkType === "PROFILE" ? "https://facebook.com/username" : "https://facebook.com/watch?v=...";
      case "spotify":
        return linkType === "PROFILE" ? "https://open.spotify.com/artist/..." : "https://open.spotify.com/track/...";
      default:
        return "https://...";
    }
  }, [platform, linkType]);

  // Inline format validation
  const linkValidation = useMemo(() => {
    if (!targetUrl.trim()) {
      return { isValid: false, error: null };
    }
    return validateServiceLink(targetUrl.trim(), selectedService?.platform || platform, linkType);
  }, [targetUrl, selectedService, platform, linkType]);

  // Service bounds
  const minQty = selectedService?.minQty || 10;
  const maxQty = selectedService?.maxQty || 1000000;
  const stepQty = selectedService?.stepQty || 100;

  // Custom comments detection & manual override
  const serviceIsCommentKind = useMemo(() => {
    if (!selectedService) return false;
    const sType = (selectedService.serviceType || "").toUpperCase();
    if (sType === "CUSTOM_COMMENTS" || sType === "COMMENTS" || sType === "COMMENTS_CUSTOM") return true;
    const name = (selectedService.displayName || selectedService.name || "").toLowerCase();
    const cat = (selectedService.categoryName || "").toLowerCase();
    return name.includes("comment") || cat.includes("comment") || name.includes("chat");
  }, [selectedService]);

  const [forceCustomComments, setForceCustomComments] = useState<boolean | null>(null);

  // Reset manual override when service changes
  useEffect(() => {
    setForceCustomComments(null);
  }, [selectedServiceId]);

  const isCustomComments = useMemo(() => {
    if (forceCustomComments !== null) return forceCustomComments;
    return serviceIsCommentKind;
  }, [forceCustomComments, serviceIsCommentKind]);

  const customCommentsLines = useMemo(() => {
    if (!isCustomComments) return [];
    return commentsText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [isCustomComments, commentsText]);

  const hasDuplicateComments = useMemo(() => {
    if (!isCustomComments || customCommentsLines.length === 0) return false;
    return new Set(customCommentsLines).size !== customCommentsLines.length;
  }, [isCustomComments, customCommentsLines]);

  const hasUrlInComments = useMemo(() => {
    if (!isCustomComments || customCommentsLines.length === 0) return false;
    const urlPattern = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.me)/i;
    return customCommentsLines.some((l) => urlPattern.test(l));
  }, [isCustomComments, customCommentsLines]);

  // Sample comment templates for rapid testing & quick fill
  const sampleCommentsList = [
    "Great content, keep it up! 🔥",
    "Super informative and well explained 👏",
    "Loved this post! Saving it for later ❤️",
    "Quality production as always! 🚀",
    "Totally agree with this point 💯",
    "Awesome share, very insightful 🙌",
    "Top notch work! ⭐",
    "Really needed to see this today ✨",
  ];

  const handleAddSampleComments = (countToAdd = 5) => {
    const existing = commentsText ? commentsText.split("\n").map((l) => l.trim()).filter(Boolean) : [];
    const available = sampleCommentsList.filter((c) => !existing.includes(c));
    const pool = available.length > 0 ? available : sampleCommentsList;
    const toAdd = pool.slice(0, countToAdd);
    const updated = [...existing, ...toAdd].join("\n");
    setCommentsText(updated);
  };

  const handleCleanComments = () => {
    const cleaned = Array.from(
      new Set(
        commentsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
      )
    ).join("\n");
    setCommentsText(cleaned);
  };

  const handleClearComments = () => {
    setCommentsText("");
    setQuantity(minQty);
  };

  useEffect(() => {
    if (isCustomComments) {
      const count = customCommentsLines.length;
      if (count > 0) {
        setQuantity(count);
      }
    }
  }, [isCustomComments, customCommentsLines.length]);

  // Quantity preset chips
  const availablePresets = useMemo(() => {
    return [100, 500, 1000, 5000, 10000].filter((p) => p >= minQty && p <= maxQty);
  }, [minQty, maxQty]);

  // Geo variants
  const geoVariants = useMemo(() => {
    const list = platformServices.filter((s) => s.geoCountry && s.geoCountry.trim() !== "");
    return Array.from(new Set(list.map((s) => s.geoCountry!)));
  }, [platformServices]);

  // Total interval calculation
  const totalDripHours = useMemo(() => {
    return selectedDays * 24 + extraHours;
  }, [selectedDays, extraHours]);

  // Notify parent of order details change
  useEffect(() => {
    if (selectedService) {
      onOrderDetailsChange({
        service: selectedService,
        targetUrl: targetUrl.trim(),
        quantity,
        ratePer1000: Number(selectedService.ratePer1000 || 50),
        isDrip: isDripEnabled,
        dripRuns: isDripEnabled ? Math.min(100, Math.max(2, selectedDays * 2)) : 1,
        dripIntervalHours: isDripEnabled ? Math.max(1, Math.round(totalDripHours / (selectedDays * 2))) : 0,
        customComments: isCustomComments ? customCommentsLines : undefined,
        geoCountry: geoCountry || undefined,
      });
    }
  }, [
    selectedService,
    targetUrl,
    quantity,
    isDripEnabled,
    selectedDays,
    extraHours,
    totalDripHours,
    isCustomComments,
    customCommentsLines,
    geoCountry,
    onOrderDetailsChange,
  ]);

  // Handle Paste helper
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setTargetUrl(text.trim());
      }
    } catch {
      // Clipboard denied
    }
  };

  // Prefill from Favorite or Recent Order (never auto-orders, re-prices from server)
  const handlePrefillItem = (item: {
    serviceId: string;
    targetUrl?: string;
    quantity?: number;
    title: string;
  }) => {
    const s = platformServices.find((svc) => svc.id === item.serviceId);
    if (s) {
      setSelectedServiceId(s.id);
      if (s.categoryId) setSelectedCategoryId(s.categoryId);
    }
    if (item.targetUrl) setTargetUrl(item.targetUrl);
    if (item.quantity) setQuantity(item.quantity);
    setPrefillSource(item.title);
  };

  // Loading skeleton state
  if (isLoading && platformServices.length === 0) {
    return (
      <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded" />
          <div className="h-11 w-full bg-slate-100 dark:bg-[#131313] border border-slate-200 dark:border-white/5 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded" />
          <div className="h-14 w-full bg-slate-100 dark:bg-[#131313] border border-slate-200 dark:border-white/5 rounded-xl" />
        </div>
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-[#16181D] border border-slate-200 dark:border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="h-12 bg-slate-200 dark:bg-white/5 rounded-lg" />
          <div className="h-12 bg-slate-200 dark:bg-white/5 rounded-lg" />
          <div className="h-12 bg-slate-200 dark:bg-white/5 rounded-lg" />
          <div className="h-12 bg-slate-200 dark:bg-white/5 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 bg-slate-200 dark:bg-white/10 rounded" />
          <div className="h-11 w-full bg-slate-100 dark:bg-[#131313] border border-slate-200 dark:border-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  // Friendly empty state
  if (!isLoading && platformServices.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-[#131313] border border-slate-200 dark:border-white/10 text-center space-y-3 w-full max-w-full">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <h4 className="text-sm font-bold text-fg">No services found for {platform.toUpperCase()}</h4>
        <p className="text-xs text-fg-muted max-w-sm mx-auto">
          Catalog services for this platform are currently being updated. Please choose another platform above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 overflow-hidden">
      {/* Prefill Dismissible Notification Banner */}
      {prefillSource && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-between text-xs text-[#171e00] dark:text-[#D8EC8D]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-[#D8EC8D]" />
            <span>
              Prefilled details from <strong>{prefillSource}</strong>. Real-time rate re-quoted from server.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPrefillSource(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Favorites & Recent Orders Quick Strips (Section 4.2) */}
      <div className="space-y-2">
        {favorites && favorites.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none no-scrollbar">
            <span className="text-slate-500 flex items-center gap-1 shrink-0 text-[11px] font-medium">
              <Star className="w-3.5 h-3.5 text-warning fill-amber-400" />
              <span>Favorites:</span>
            </span>
            {favorites.slice(0, 5).map((fav) => (
              <button
                key={fav.id}
                type="button"
                onClick={() =>
                  handlePrefillItem({
                    serviceId: fav.serviceId,
                    targetUrl: fav.targetUrl,
                    quantity: fav.defaultQuantity || fav.quantity,
                    title: fav.customName || fav.name || "Saved Favorite",
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-fg-2 border border-slate-200/80 dark:border-white/5 whitespace-nowrap transition-colors flex items-center gap-1.5 font-medium"
              >
                <span>{fav.customName || fav.name || "Favorite"}</span>
              </button>
            ))}
          </div>
        )}

        {recentOrders && recentOrders.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none no-scrollbar">
            <span className="text-slate-500 flex items-center gap-1 shrink-0 text-[11px] font-medium">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span>Recent orders:</span>
            </span>
            {recentOrders.slice(0, 5).map((ro) => (
              <button
                key={ro.id}
                type="button"
                onClick={() =>
                  handlePrefillItem({
                    serviceId: ro.serviceId,
                    targetUrl: ro.target,
                    quantity: ro.quantity,
                    title: `Order #${ro.id.slice(-6)}`,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-fg-2 border border-slate-200/80 dark:border-white/5 whitespace-nowrap transition-colors flex items-center gap-1.5"
              >
                <span className="font-mono text-slate-400">#{ro.id.slice(-5)}</span>
                <span className="truncate max-w-[140px]">{ro.serviceName || "Service"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Category Selection (Custom Searchable Dropdown for Light & Dark Theme) */}
      <section aria-labelledby="category-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <label id="category-heading" className="text-xs font-bold text-fg-2 uppercase tracking-wider block">
            2. Category
          </label>
          <span className="text-[11px] text-slate-500 font-mono">
            {platformServices.length} services available
          </span>
        </div>

        {/* Custom Category Combobox Trigger & Dropdown */}
        <div ref={categoryDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
              setIsServiceDropdownOpen(false);
            }}
            className="w-full min-w-0 max-w-full min-h-[48px] p-3 rounded-xl bg-white dark:bg-[#131313] border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 text-left transition-all flex items-center justify-between gap-3 focus:outline-none focus:ring-1 focus:ring-[#D8EC8D]/60 shadow-xs cursor-pointer"
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider truncate">
                Selected Category
              </div>
              <div className="text-xs font-bold text-fg truncate mt-0.5">
                {selectedCategoryName}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                {selectedCategoryId === "ALL" ? `${categoryList.length} categories` : `${categoryFilteredServices.length} services`}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {/* Category Dropdown Menu */}
          {isCategoryDropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-[#18181B] border border-slate-300 dark:border-white/20 shadow-2xl overflow-hidden max-w-full">
              {/* Category Search input header */}
              <div className="p-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-[#121214]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  placeholder="Search categories (e.g. Story, Followers, Likes)..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-medium"
                  autoFocus
                />
                {categorySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCategorySearchQuery("")}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Options List */}
              <div className="max-h-[280px] overflow-y-auto p-2 space-y-1">
                {/* Option: All Categories */}
                {(!categorySearchQuery.trim() || "all categories".includes(categorySearchQuery.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId("ALL");
                      setIsCategoryDropdownOpen(false);
                      setCategorySearchQuery("");
                      setSearchQuery("");
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      selectedCategoryId === "ALL"
                        ? "bg-[#D8EC8D]/25 dark:bg-[#D8EC8D]/20 border border-[#8CA81E] dark:border-[#D8EC8D]/50 text-slate-900 dark:text-white font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedCategoryId === "ALL" && (
                        <Check className="w-4 h-4 text-[#171e00] dark:text-[#D8EC8D] shrink-0" />
                      )}
                      <span className="text-xs truncate">All Categories</span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                      {platformServices.length}
                    </span>
                  </button>
                )}

                {/* Filtered categories */}
                {filteredCategoryList.length === 0 && categorySearchQuery.trim() ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No categories found matching &quot;{categorySearchQuery}&quot;
                  </div>
                ) : (
                  filteredCategoryList.map((cat) => {
                    const isSelected = cat.id === selectedCategoryId;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(cat.id);
                          setIsCategoryDropdownOpen(false);
                          setCategorySearchQuery("");
                          setSearchQuery("");
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-[#D8EC8D]/25 dark:bg-[#D8EC8D]/20 border border-[#8CA81E] dark:border-[#D8EC8D]/50 text-slate-900 dark:text-white font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100 font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected && (
                            <Check className="w-4 h-4 text-[#171e00] dark:text-[#D8EC8D] shrink-0" />
                          )}
                          <span className="text-xs truncate">{cat.name}</span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                          {cat.count}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Searchable Service Selection */}
      <section aria-labelledby="service-heading" className="space-y-2">
        <div className="flex items-center justify-between">
          <label id="service-heading" className="text-xs font-bold text-fg-2 uppercase tracking-wider">
            3. Service
          </label>
          <span className="text-[11px] text-slate-500">
            {eligibleServices.length} {eligibleServices.length === 1 ? "option" : "options"}
          </span>
        </div>

        {/* Searchable Combobox Trigger & Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsServiceDropdownOpen(!isServiceDropdownOpen);
              setIsCategoryDropdownOpen(false);
            }}
            className="w-full min-w-0 max-w-full min-h-[52px] p-3 rounded-xl bg-white dark:bg-[#131313] border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20 text-left transition-all flex items-center justify-between gap-3 focus:outline-none focus:ring-1 focus:ring-[#D8EC8D]/60 shadow-xs cursor-pointer"
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-[10px] text-fg-muted font-semibold uppercase tracking-wider truncate">
                {selectedService?.categoryName || "Catalog Service"}
              </div>
              <div className="text-xs font-bold text-fg truncate mt-0.5" title={selectedService?.displayName || selectedService?.name}>
                {selectedService?.displayName || selectedService?.name || "Select a service..."}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#171e00] dark:text-[#D8EC8D] font-mono px-2 py-0.5 rounded-md bg-accent/20 whitespace-nowrap">
                ₹{Number(selectedService?.ratePer1000 || 50).toFixed(2)}/1k
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isServiceDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {/* Expanded Search Dropdown Modal/Sheet */}
          {isServiceDropdownOpen && (
            <div className="absolute z-40 left-0 right-0 mt-2 rounded-2xl bg-white dark:bg-[#18181B] border border-slate-300 dark:border-white/20 shadow-2xl overflow-hidden max-w-full">
              {/* Search input header */}
              <div className="p-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-[#121214]">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search service name, speed, refill..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none font-medium"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Services List */}
              <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {eligibleServices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No services found matching &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  eligibleServices.map((svc) => {
                    const isSelected = svc.id === selectedServiceId;
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => {
                          setSelectedServiceId(svc.id);
                          setIsServiceDropdownOpen(false);
                          setSearchQuery("");
                          setQuantity(Math.max(svc.minQty || 10, quantity));
                        }}
                        className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? "bg-[#D8EC8D]/25 dark:bg-[#D8EC8D]/20 border border-[#8CA81E] dark:border-[#D8EC8D]/50 text-slate-900 dark:text-white font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[#171e00] dark:text-[#D8EC8D] shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {svc.displayName || svc.name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Min: {formatIndianNumber(svc.minQty)}</span>
                            <span>·</span>
                            <span>Max: {formatIndianNumber(svc.maxQty)}</span>
                            {svc.refillable && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
                                Refill
                              </span>
                            )}
                            {svc.cancellable && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-[10px] font-medium">
                                Cancel
                              </span>
                            )}
                            {svc.dripFeedSupported && (
                              <span className="px-1.5 py-0.2 rounded bg-accent/25 text-[#171e00] dark:text-[#D8EC8D] text-[10px] font-medium">
                                Drip-feed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                            ₹{Number(svc.ratePer1000).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-500">per 1,000</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4-Fact Key Service Details Card + Description (Section 4.2) */}
        {selectedService && (
          <GlassCard className="p-4 border-slate-200/90 dark:border-white/5 bg-slate-50/70 dark:bg-[#16181D]/80 shadow-xs rounded-xl space-y-3 min-w-0 max-w-full overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="min-w-0 overflow-hidden">
                <span className="text-fg-muted text-[11px] block truncate">Price / 1,000</span>
                <span className="text-[#171e00] dark:text-[#D8EC8D] font-bold font-mono text-sm block truncate">
                  ₹{Number(selectedService.ratePer1000).toFixed(2)}
                </span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="text-fg-muted text-[11px] block truncate">Min – Max</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-medium block truncate">
                  {formatIndianNumber(minQty)} – {formatIndianNumber(maxQty)}
                </span>
                <span className="text-slate-400 text-[10px] block truncate">Step: {formatIndianNumber(stepQty)}</span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="text-fg-muted text-[11px] block truncate">Start / Avg Time</span>
                <span
                  className="text-slate-800 dark:text-slate-200 font-medium block truncate"
                  title={selectedService.avgTime || selectedService.avgStartTime || "15 - 30 mins"}
                >
                  {selectedService.avgTime || selectedService.avgStartTime || "15 - 30 mins"}
                </span>
              </div>
              <div className="min-w-0 overflow-hidden">
                <span className="text-fg-muted text-[11px] block truncate">Refill & Cancel</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium block truncate">
                  {selectedService.refillable ? "Refill: Yes" : "Refill: No"} ·{" "}
                  {selectedService.cancellable ? "Cancel: Yes" : "Cancel: No"}
                </span>
              </div>
            </div>

            {/* Clean Service Description */}
            {selectedService.description && selectedService.description.trim() !== "" && (
              <div className="border-t border-slate-200 dark:border-white/5 pt-2.5 text-xs text-fg-muted leading-relaxed font-normal break-words overflow-hidden">
                {selectedService.description}
              </div>
            )}
          </GlassCard>
        )}
      </section>

      {/* 4. Target Link & Quantity Details */}
      <section aria-labelledby="details-heading" className="space-y-4">
        <label id="details-heading" className="text-xs font-bold text-fg-2 uppercase tracking-wider block">
          4. Details
        </label>

        {/* Target Link Input */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-fg-2 font-medium text-xs">{linkLabel}</span>
            <span className="text-slate-500 text-[11px]">The account or post must be public.</span>
          </div>

          <div className="relative flex items-center">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={linkPlaceholder}
              className={`w-full pl-10 pr-20 py-3 rounded-xl bg-white dark:bg-[#131313] border text-fg text-xs font-mono placeholder:text-slate-400 focus:outline-none transition-all shadow-xs ${
                targetUrl && !linkValidation.isValid
                  ? "border-red-500/70 focus:ring-1 focus:ring-red-500"
                  : "border-slate-300 dark:border-white/10 focus:border-[#D8EC8D]/60 focus:ring-1 focus:ring-[#D8EC8D]/60"
              }`}
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.15] text-[11px] text-fg-2 font-medium flex items-center gap-1 transition-colors select-none"
            >
              <Clipboard className="w-3 h-3" />
              <span>Paste</span>
            </button>
          </div>

          {/* Validation Feedback */}
          {targetUrl && !linkValidation.isValid && linkValidation.error && (
            <p className="text-red-500 dark:text-red-400 text-xs font-medium flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{linkValidation.error}</span>
            </p>
          )}
        </div>

        {/* Quantity Controls */}
        <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-fg-2 font-medium">Quantity</span>
              <span className="text-slate-500 font-mono text-[11px]">
                Min: {formatIndianNumber(minQty)} · Max: {formatIndianNumber(maxQty)} · Step: {formatIndianNumber(stepQty)}
              </span>
            </div>

            <div className="flex items-center gap-2 max-w-full min-w-0">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(minQty, quantity - stepQty))}
                className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition-colors text-base select-none shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min={minQty}
                max={maxQty}
                step={stepQty}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white dark:bg-[#131313] border border-slate-300 dark:border-white/10 text-fg text-xs font-mono text-center focus:outline-none focus:border-[#D8EC8D]/60 transition-all font-bold h-11"
              />
              <button
                type="button"
                onClick={() => setQuantity(Math.min(maxQty, quantity + stepQty))}
                className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center transition-colors text-base select-none shrink-0"
              >
                +
              </button>
            </div>

            {/* Quick preset chips */}
            {availablePresets.length > 0 && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {availablePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono transition-colors select-none ${
                      quantity === preset
                        ? "bg-[#D8EC8D] text-[#171e00] font-bold shadow-[0_0_10px_rgba(216,236,141,0.25)]"
                        : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 text-fg-muted hover:bg-slate-200 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"
                    }`}
                  >
                    {formatIndianNumber(preset)}
                  </button>
                ))}
              </div>
            )}

            {/* Bounds Warnings */}
            {quantity < minQty && (
              <p className="text-red-500 dark:text-red-400 text-xs font-medium flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Quantity is below the minimum allowed ({formatIndianNumber(minQty)}).</span>
              </p>
            )}
            {quantity > maxQty && (
              <p className="text-red-500 dark:text-red-400 text-xs font-medium flex items-center gap-1.5 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Quantity exceeds the maximum allowed ({formatIndianNumber(maxQty)}).</span>
              </p>
            )}
            {stepQty > 1 && quantity % stepQty !== 0 && (
              <p className="text-warning text-xs flex items-center gap-1.5 mt-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Recommended in increments of {formatIndianNumber(stepQty)}.</span>
              </p>
            )}
          </div>

        {/* Audience Region (Optional, only where geo variants exist) */}
        {geoVariants.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-white/5">
            <span className="text-fg-2 font-medium text-xs block">
              Audience Country / Region (Optional)
            </span>
            <GenericSelect
              options={[
                { value: "", label: "Global / Standard Delivery" },
                ...geoVariants.map((c) => ({ value: c, label: `${c} Targeted Variant` })),
              ]}
              value={geoCountry}
              onChange={(val) => setGeoCountry(String(val))}
              className="w-full"
              buttonClassName="w-full justify-between py-2.5 px-3.5"
            />
          </div>
        )}

        {/* Gradual Pacing (Drip Delivery) Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#16181D]/80 border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3 min-w-0 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
              <Calendar className="w-4 h-4 text-[#D8EC8D] shrink-0 mt-0.5 sm:mt-0" />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-fg block truncate">
                  Looking for gradual (drip-feed) delivery?
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  Use our schedule controls or switch to multi-day packages.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {onSwitchTab && (
                <button
                  type="button"
                  onClick={() => onSwitchTab("custom_drip")}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/[0.08] hover:bg-slate-300 dark:hover:bg-white/[0.15] text-[11px] text-fg-2 font-medium transition-colors"
                >
                  Switch to Custom Package
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDripEnabled(!isDripEnabled)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
                  isDripEnabled ? "bg-[#D8EC8D]" : "bg-slate-300 dark:bg-white/10"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-black transition-transform absolute top-0.5 ${
                    isDripEnabled ? "left-5.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>

          {isDripEnabled && (
            <div className="pt-3 border-t border-slate-200 dark:border-white/5 space-y-3">
              <div className="space-y-1.5">
                <span className="text-[11px] text-fg-muted block">Completion Duration</span>
                <div className="flex flex-wrap gap-2">
                  {durationChips.slice(0, 8).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setSelectedDays(days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedDays === days
                          ? "bg-[#D8EC8D] text-[#171e00] font-bold"
                          : "bg-slate-200 dark:bg-white/[0.04] text-fg-2 hover:bg-slate-300 dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      {days} {days === 1 ? "Day" : "Days"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-fg-muted">
                  <span>Extra Hours Buffer</span>
                  <span className="text-fg font-mono">{extraHours} hrs</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={extraHours}
                  onChange={(e) => setExtraHours(parseInt(e.target.value, 10))}
                  className="w-full accent-[#D8EC8D]"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
