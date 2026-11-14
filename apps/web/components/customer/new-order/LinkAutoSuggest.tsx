"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useCustomer } from "@/context/CustomerContext";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { History, Link2, Sparkles, X, Clipboard, Check, ChevronDown } from "lucide-react";

interface SuggestionItem {
  id: string;
  targetUrl: string;
  displayLabel: string;
  platform: string;
  source: "recent" | "package" | "favorite";
}

interface LinkAutoSuggestProps {
  value: string;
  onChange: (val: string) => void;
  platform?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function LinkAutoSuggest({
  value,
  onChange,
  platform = "instagram",
  placeholder = "https://instagram.com/p/... or @username",
  className = "",
  disabled = false,
}: LinkAutoSuggestProps) {
  const { orders, packages, favorites } = useCustomer();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Aggregate and deduplicate suggestions from orders, packages, and favorites
  const suggestions = useMemo<SuggestionItem[]>(() => {
    const map = new Map<string, SuggestionItem>();

    // 1. From favorites
    (favorites || []).forEach((fav: any) => {
      const url = fav.targetUrl?.trim();
      if (url && !map.has(url)) {
        let label = url;
        if (url.startsWith("http")) {
          try {
            const u = new URL(url);
            label = u.pathname.replace(/^\//, "") || u.hostname;
          } catch {}
        }
        map.set(url, {
          id: `fav_${fav.id || url}`,
          targetUrl: url,
          displayLabel: label,
          platform: fav.service?.platform || platform,
          source: "favorite",
        });
      }
    });

    // 2. From active packages
    (packages || []).forEach((pkg: any) => {
      const handle = pkg.handle || pkg.targetUrl;
      if (handle && handle.trim()) {
        const clean = handle.trim();
        const fullUrl = clean.startsWith("http")
          ? clean
          : `https://instagram.com/${clean.replace(/^@/, "")}`;
        if (!map.has(fullUrl)) {
          map.set(fullUrl, {
            id: `pkg_${pkg.id || clean}`,
            targetUrl: fullUrl,
            displayLabel: clean.startsWith("@") ? clean : `@${clean}`,
            platform: pkg.platform || platform,
            source: "package",
          });
        }
      }
    });

    // 3. From recent orders
    (orders || []).slice(0, 30).forEach((o: any) => {
      const target = o.target?.trim();
      if (target && !map.has(target)) {
        let label = target;
        if (target.startsWith("http")) {
          try {
            const u = new URL(target);
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length >= 2) {
              label = `${parts[0].toUpperCase()} • ${parts[1].slice(0, 10)}`;
            } else if (parts.length === 1) {
              label = `@${parts[0]}`;
            }
          } catch {}
        }
        map.set(target, {
          id: `ord_${o.id || target}`,
          targetUrl: target,
          displayLabel: label,
          platform: o.platform || platform,
          source: "recent",
        });
      }
    });

    return Array.from(map.values());
  }, [orders, packages, favorites, platform]);

  // Filter based on input value if user has typed something
  const filteredSuggestions = useMemo(() => {
    if (!value || !value.trim()) return suggestions.slice(0, 5);
    const q = value.toLowerCase().trim();
    return suggestions
      .filter(
        (s) =>
          s.targetUrl.toLowerCase().includes(q) ||
          s.displayLabel.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [suggestions, value]);

  const handleSelect = (url: string) => {
    onChange(url);
    setIsOpen(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        onChange(text.trim());
      }
    } catch {}
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-surface-raised border border-border focus:border-focus rounded-xl pl-3.5 pr-16 py-2.5 text-xs text-fg placeholder:text-fg-muted font-mono transition-all ${className}`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-surface transition-colors"
              title="Clear link"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePaste}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-accent-text hover:bg-accent/15 border border-accent/20 transition-colors flex items-center gap-0.5"
              title="Paste from clipboard"
            >
              <Clipboard className="w-3 h-3" />
              <span>Paste</span>
            </button>
          )}

          {suggestions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="p-1 text-fg-muted hover:text-fg transition-colors"
              title="View suggestions"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Auto-Suggestion Menu */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-surface border border-border p-2 shadow-2xl backdrop-blur-xl space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono text-fg-muted uppercase tracking-wider border-b border-border">
            <span className="flex items-center gap-1 font-semibold text-accent-text">
              <History className="w-3 h-3" />
              Auto-Suggested Links &amp; Profiles
            </span>
            <span className="text-[9px]">{filteredSuggestions.length} found</span>
          </div>

          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {filteredSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.targetUrl)}
                className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-surface-raised transition-all flex items-center justify-between gap-2.5 group cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                    <PlatformIcon platform={item.platform} size={13} useBrandColor={true} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-fg truncate group-hover:text-accent-text transition-colors">
                      {item.displayLabel}
                    </div>
                    <div className="text-[10px] font-mono text-fg-muted truncate">
                      {item.targetUrl}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase ${
                      item.source === "favorite"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : item.source === "package"
                        ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        : "bg-surface-raised text-fg-muted border border-border"
                    }`}
                  >
                    {item.source}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

