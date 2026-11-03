"use client";

import React, { useState, useRef, useEffect, useMemo, useId, useCallback } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

export interface ServiceItem {
  id: string;
  name: string;
  displayName?: string | null;
  ratePer1000?: string | number;
  minQty?: number;
  maxQty?: number;
  avgTime?: string | null;
  avgStartTime?: string | null;
  speed?: string | null;
  categoryName?: string | null;
}

interface ServiceDropdownSelectProps {
  services: ServiceItem[];
  selectedServiceId: string;
  onSelect: (serviceId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
  align?: "left" | "right";
  formatCurrency?: (val: number) => string;
}

export function ServiceDropdownSelect({
  services,
  selectedServiceId,
  onSelect,
  disabled = false,
  placeholder = "Select a service...",
  emptyText = "No services available in this category",
  align = "left",
  formatCurrency = (v) => `₹${Number(v).toFixed(2)}`,
}: ServiceDropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Close dropdown on outside click (touch and pointer friendly)
  useEffect(() => {
    function handlePointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerDownOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (services.length > 4) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    } else {
      setActiveIndex(-1);
    }
  }, [isOpen, services.length]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase().trim();
    return services.filter((s) => {
      const name = (s.displayName || s.name || "").toLowerCase();
      const cat = (s.categoryName || "").toLowerCase();
      const rate = String(s.ratePer1000 || "");
      const id = String(s.id || "");
      return name.includes(q) || cat.includes(q) || rate.includes(q) || id.includes(q);
    });
  }, [services, searchQuery]);

  const handleSelect = useCallback((serviceId: string) => {
    onSelect(serviceId);
    setIsOpen(false);
    setSearchQuery("");
    triggerRef.current?.focus();
  }, [onSelect]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredServices.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredServices.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < filteredServices.length) {
      e.preventDefault();
      handleSelect(filteredServices[activeIndex].id);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full mt-1" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={selectedService ? `Selected service: ${selectedService.displayName || selectedService.name}` : placeholder}
        className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-left transition-all flex items-center justify-between gap-2.5 shadow-xs border focus:outline-none focus:ring-2 focus:ring-focus/40 ${
          disabled
            ? "bg-surface-raised/50 border-border/40 text-fg-muted cursor-not-allowed opacity-60"
            : isOpen
            ? "bg-surface border-focus shadow-md ring-1 ring-focus/40"
            : "bg-surface hover:bg-surface-raised border-border text-fg hover:border-border-control cursor-pointer"
        }`}
      >
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          {selectedService ? (
            <span
              className="text-xs font-semibold text-fg truncate"
              title={selectedService.displayName || selectedService.name}
            >
              {selectedService.displayName || selectedService.name}
            </span>
          ) : (
            <span className="text-xs text-fg-muted italic truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedService && selectedService.ratePer1000 !== undefined && (
            <span className="px-2 py-0.5 rounded-md bg-accent/15 text-accent-text border border-accent/25 text-[11px] font-mono font-bold whitespace-nowrap shadow-xs">
              {formatCurrency(Number(selectedService.ratePer1000))} / 1k
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-fg-muted transition-transform duration-200 ${
              isOpen ? "rotate-180 text-accent-text" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Available services"
          className={`absolute z-50 mt-1.5 rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden backdrop-blur-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in fade-in-0 zoom-in-95 duration-100 ${
            align === "right" ? "right-0 left-auto w-full min-w-[280px]" : "left-0 right-0 w-full"
          }`}
        >
          {/* Search Header for quick discovery */}
          {services.length > 4 && (
            <div className="p-2.5 border-b border-border flex items-center gap-2 bg-surface-raised/70">
              <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search services, speed, rates..."
                aria-label="Search services"
                className="w-full bg-transparent text-xs text-fg placeholder:text-fg-muted focus:outline-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-glass transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 overscroll-contain">
            {services.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-fg-muted">
                {emptyText}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-2">
                <p className="text-xs text-fg-muted">No services match &quot;{searchQuery}&quot;</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[11px] text-accent-text font-bold hover:underline"
                >
                  Show all ({services.length})
                </button>
              </div>
            ) : (
              filteredServices.map((svc, idx) => {
                const isSelected = svc.id === selectedServiceId;
                const isHighlighted = idx === activeIndex;
                const rateNum = Number(svc.ratePer1000 || 0);

                return (
                  <button
                    key={svc.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(svc.id)}
                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start justify-between gap-3 cursor-pointer group ${
                      isSelected
                        ? "bg-accent/20 border border-accent/40 text-fg font-bold shadow-xs"
                        : isHighlighted
                        ? "bg-surface-raised border border-border-control text-fg"
                        : "hover:bg-surface-raised text-fg border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold leading-snug break-words">
                          {svc.displayName || svc.name}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-accent-text shrink-0 inline ml-1" />
                        )}
                      </div>

                      {/* Service meta tags (Min-Max, Speed) */}
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-fg-muted">
                        {svc.minQty !== undefined && svc.maxQty !== undefined && (
                          <span className="font-mono">
                            Min: {svc.minQty.toLocaleString()} · Max: {svc.maxQty.toLocaleString()}
                          </span>
                        )}
                        {(svc.speed || svc.avgTime || svc.avgStartTime) && (
                          <span>· {svc.speed || svc.avgTime || svc.avgStartTime}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center pt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold whitespace-nowrap border ${
                          isSelected
                            ? "bg-accent text-on-accent border-accent/40 shadow-glow"
                            : "bg-surface-raised text-fg-2 border-border group-hover:border-accent/30 group-hover:text-accent-text"
                        }`}
                      >
                        {formatCurrency(rateNum)} / 1k
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface GenericOption {
  value: string | number;
  label: string;
}

interface GenericSelectProps {
  options: GenericOption[];
  value: string | number;
  onChange: (value: any) => void;
  disabled?: boolean;
  align?: "left" | "right";
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export function GenericSelect({
  options,
  value,
  onChange,
  disabled = false,
  align = "left",
  ariaLabel,
  className = "",
  buttonClassName = "",
}: GenericSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function handlePointerDownOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("pointerdown", handlePointerDownOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || options[0],
    [options, value]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel || selectedOption?.label || String(value)}
        className={`px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-raised border border-border text-fg text-xs font-medium flex items-center justify-between gap-2 transition-all shadow-xs focus:outline-none focus:ring-1 focus:ring-focus ${
          isOpen ? "border-focus ring-1 ring-focus/40" : ""
        } ${buttonClassName}`}
      >
        <span className="truncate">{selectedOption?.label || String(value)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-fg-muted transition-transform shrink-0 ${
            isOpen ? "rotate-180 text-accent-text" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel || "Options"}
          className={`absolute z-50 mt-1 rounded-xl bg-surface border border-border shadow-xl p-1 space-y-0.5 overflow-hidden backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100 ${
            align === "right"
              ? "right-0 left-auto min-w-full w-max max-w-[280px]"
              : "left-0 right-auto min-w-full w-max max-w-[280px]"
          }`}
        >
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-accent/20 text-fg font-bold"
                      : "hover:bg-surface-raised text-fg-2 hover:text-fg"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-accent-text shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
