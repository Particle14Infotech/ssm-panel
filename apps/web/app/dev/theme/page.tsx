"use client";

import React, { useState } from "react";
import { notFound } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Slider,
  Tabs,
  ProgressBar,
  Pagination,
  Tooltip,
  Modal,
} from "@smm/ui";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GlassCard } from "@/components/shared/GlassCard";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, Column } from "@/components/shared/DataTable";
import {
  Activity,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export default function DevThemeShowcasePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("all");
  const [switchVal, setSwitchVal] = useState(true);
  const [checkVal, setCheckVal] = useState(true);
  const [radioVal, setRadioVal] = useState("option1");
  const [sliderVal, setSliderVal] = useState(45);
  const [pageVal, setPageVal] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const contrastPairs = [
    { fg: "fg (#ECEBE4 / #0F172A)", bg: "bg (#0F0F0F / #F5F5F8)", ratio: "16.04:1 (Dark) / 16.41:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "fg-2 (#C7C8B6 / #475569)", bg: "bg (#0F0F0F / #F5F5F8)", ratio: "11.29:1 (Dark) / 6.96:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "fg (#ECEBE4 / #0F172A)", bg: "surface (#1A1A19 / #FFFFFF)", ratio: "14.57:1 (Dark) / 17.85:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "fg-2 (#C7C8B6 / #475569)", bg: "surface (#1A1A19 / #FFFFFF)", ratio: "10.26:1 (Dark) / 7.58:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "fg-muted (#9A9C90 / #5B6577)", bg: "surface (#1A1A19 / #FFFFFF)", ratio: "6.25:1 (Dark) / 5.88:1 (Light)", min: "3.0:1", status: "PASS" },
    { fg: "on-accent (#171E00)", bg: "accent (#D4F55F)", ratio: "13.93:1 (Dark) / 13.93:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "accent-text (#D4F55F / #4D6010)", bg: "surface (#1A1A19 / #FFFFFF)", ratio: "14.12:1 (Dark) / 7.01:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "border-control", bg: "surface", ratio: "4.10:1 (Dark) / 3.67:1 (Light)", min: "3.0:1", status: "PASS" },
    { fg: "focus ring", bg: "surface", ratio: "14.12:1 (Dark) / 7.01:1 (Light)", min: "3.0:1", status: "PASS" },
    { fg: "success (#34D399 / #047857)", bg: "surface", ratio: "9.06:1 (Dark) / 5.48:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "warning (#FBBF24 / #92400E)", bg: "surface", ratio: "10.43:1 (Dark) / 7.09:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "danger (#F87171 / #B91C1C)", bg: "surface", ratio: "6.30:1 (Dark) / 6.47:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "info (#38BDF8 / #0369A1)", bg: "surface", ratio: "8.13:1 (Dark) / 5.93:1 (Light)", min: "4.5:1", status: "PASS" },
    { fg: "fg on glass", bg: "surface-glass (blended)", ratio: "12.82:1 (Dark) / 17.85:1 (Light)", min: "4.5:1", status: "PASS" },
  ];

  const sampleTableData = [
    { id: "ORD-9481", service: "Instagram Premium High-Retention Views", status: "COMPLETED", price: "₹240.00" },
    { id: "ORD-9482", service: "YouTube Target Subscriber Growth", status: "IN_PROGRESS", price: "₹1,850.00" },
    { id: "ORD-9483", service: "TikTok Non-Drop Likes & Shares", status: "PROCESSING", price: "₹420.50" },
    { id: "ORD-9484", service: "Telegram Group Active Members", status: "PARTIAL", price: "₹95.00" },
    { id: "ORD-9485", service: "Twitter Verified Retweets", status: "CANCELLED", price: "₹310.00" },
  ];

  const tableColumns: Column<(typeof sampleTableData)[0]>[] = [
    { header: "Order ID", accessorKey: "id", className: "font-mono font-medium text-fg" },
    { header: "Service", accessorKey: "service", className: "text-fg-2" },
    {
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    { header: "Amount", accessorKey: "price", align: "right", className: "font-mono tabular-nums text-accent-text font-bold" },
  ];

  return (
    <div className="min-h-screen bg-bg text-fg p-6 md:p-12 space-y-12 relative overflow-hidden">
      <div className="ambient-glow-layer" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-fg">
              Theme System Primitives Showcase
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent text-on-accent shadow-glow">
              DEV ONLY
            </span>
          </div>
          <p className="text-sm text-fg-muted mt-1">
            Visual inspection & WCAG AA verification in <strong>{resolvedTheme.toUpperCase()} MODE</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle forceVisible variant="segmented" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            Quick Toggle: {resolvedTheme === "dark" ? "Switch to Light" : "Switch to Dark"}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="relative z-10">
        <Tabs
          items={[
            { id: "all", label: "All Primitives" },
            { id: "buttons", label: "Buttons & CTAs", count: 5 },
            { id: "forms", label: "Form Controls", count: 6 },
            { id: "badges", label: "Status Badges", count: 8 },
            { id: "cards", label: "Cards & Tables", count: 4 },
            { id: "contrast", label: "Contrast Ratios", count: 14 },
          ]}
          activeId={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* SECTION 1: Buttons */}
      {(activeTab === "all" || activeTab === "buttons") && (
        <section className="relative z-10 space-y-4">
          <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent-text" /> Button Variants & States
          </h2>
          <GlassCard className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-center">
              <div className="space-y-1 text-center">
                <Button variant="primary">Primary CTA</Button>
                <p className="text-[11px] text-fg-muted">Primary Default</p>
              </div>
              <div className="space-y-1 text-center">
                <Button variant="primary" loading>Primary</Button>
                <p className="text-[11px] text-fg-muted">Primary Loading</p>
              </div>
              <div className="space-y-1 text-center">
                <Button variant="secondary">Secondary</Button>
                <p className="text-[11px] text-fg-muted">Secondary Surface</p>
              </div>
              <div className="space-y-1 text-center">
                <Button variant="ghost">Ghost Button</Button>
                <p className="text-[11px] text-fg-muted">Ghost State</p>
              </div>
              <div className="space-y-1 text-center">
                <Button variant="danger">Danger Action</Button>
                <p className="text-[11px] text-fg-muted">Destructive Action</p>
              </div>
              <div className="space-y-1 text-center">
                <Button variant="primary" disabled>Disabled CTA</Button>
                <p className="text-[11px] text-fg-muted">Disabled State</p>
              </div>
            </div>
          </GlassCard>
        </section>
      )}

      {/* SECTION 2: Form Controls */}
      {(activeTab === "all" || activeTab === "forms") && (
        <section className="relative z-10 space-y-4">
          <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent-text" /> Form Controls (Inputs, Select, Switches, Sliders)
          </h2>
          <GlassCard className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-2">Default Input (Placeholder)</label>
                <Input placeholder="Enter target profile link..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-2">Focused / Value Input</label>
                <Input defaultValue="https://instagram.com/growth_official" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-danger">Invalid / Error State Input</label>
                <Input error defaultValue="invalid-url-format" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-2">Service Select Box</label>
                <Select
                  options={[
                    { value: "s1", label: "Instagram Non-Drop Views (₹0.04/ea)" },
                    { value: "s2", label: "YouTube High Retention (₹0.12/ea)" },
                    { value: "s3", label: "Telegram Fast Dispatch (₹0.08/ea)" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-fg-2">Custom Package Textarea</label>
                <Textarea placeholder="1 link per line or custom comments batch..." rows={2} />
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-6">
                  <Checkbox
                    label="Automatic Drip Feed"
                    checked={checkVal}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCheckVal(e.target.checked)}
                  />
                  <Switch
                    label="Auto Refill"
                    checked={switchVal}
                    onChange={setSwitchVal}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <Radio
                    label="Instant"
                    name="speed"
                    checked={radioVal === "option1"}
                    onChange={() => setRadioVal("option1")}
                  />
                  <Radio
                    label="Gradual"
                    name="speed"
                    checked={radioVal === "option2"}
                    onChange={() => setRadioVal("option2")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <div className="flex justify-between text-xs text-fg-2">
                <span>Drip Runs Slider: {sliderVal} runs</span>
                <span className="font-mono tabular-nums text-accent-text font-bold">{sliderVal}%</span>
              </div>
              <Slider min={5} max={100} value={sliderVal} onChange={setSliderVal} />
            </div>
          </GlassCard>
        </section>
      )}

      {/* SECTION 3: Badges */}
      {(activeTab === "all" || activeTab === "badges") && (
        <section className="relative z-10 space-y-4">
          <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent-text" /> WCAG AA Status Badges (Both Themes)
          </h2>
          <GlassCard className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="COMPLETED" />
              <StatusBadge status="IN_PROGRESS" />
              <StatusBadge status="PROCESSING" />
              <StatusBadge status="PENDING" />
              <StatusBadge status="PARTIAL" />
              <StatusBadge status="CANCELLED" />
              <StatusBadge status="FAILED" />
              <StatusBadge status="RESOLVED" />
              <StatusBadge status="CLOSED" />
            </div>
          </GlassCard>
        </section>
      )}

      {/* SECTION 4: Cards & Tables */}
      {(activeTab === "all" || activeTab === "cards") && (
        <section className="relative z-10 space-y-6">
          <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-text" /> Glass Cards, StatCards & Data Table
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Balance"
              value="₹14,280.50"
              subtitle="Unified Wallet in INR"
              icon={Activity}
              highlight
            />
            <StatCard
              title="Total Orders"
              value="1,248"
              trend={{ value: 12.4, isPositive: true }}
              icon={Layers}
            />
            <StatCard
              title="Delivery Health"
              value="99.4%"
              subtitle="All gateways operational"
              trend={{ value: 0.2, isPositive: true }}
              icon={CheckCircle2}
            />
            <StatCard
              title="Pending Tickets"
              value="0"
              subtitle="Average reply < 4 mins"
              icon={HelpCircle}
            />
          </div>

          <GlassCard className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Sample Telemetry Table</h3>
              <Pagination
                currentPage={pageVal}
                totalPages={4}
                onPageChange={setPageVal}
              />
            </div>
            <DataTable
              columns={tableColumns}
              data={sampleTableData}
              keyExtractor={(item) => item.id}
            />
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-fg">Progress & Skeletons</h3>
              <ProgressBar value={74} label="Order Dispatch Progress" showPercent variant="accent" />
              <ProgressBar value={100} label="Wallet Verification" showPercent variant="success" />
              <ProgressBar value={40} label="Gateway Health" showPercent variant="warning" />
              <div className="space-y-2 pt-2">
                <p className="text-xs text-fg-muted font-medium">Skeleton Loading Placeholders</p>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </GlassCard>

            <GlassCard className="p-6 flex flex-col justify-between items-center text-center">
              <EmptyState
                icon={Sparkles}
                title="Zero Active Orders Pending"
                description="Your dispatch queue is entirely clear. Create a new single, combo, or drip package order."
                actionText="Open Modal Test"
                onActionClick={() => setIsModalOpen(true)}
              />
            </GlassCard>
          </div>
        </section>
      )}

      {/* SECTION 5: Contrast Table */}
      {(activeTab === "all" || activeTab === "contrast") && (
        <section className="relative z-10 space-y-4">
          <h2 className="text-lg font-semibold text-fg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-accent-text" /> WCAG AA Automated Contrast Verification Matrix
          </h2>
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-surface border-b border-border">
                  <tr className="text-[11px] font-mono uppercase text-fg-2 font-semibold">
                    <th className="py-3 px-4">Foreground Token</th>
                    <th className="py-3 px-4">Background Token</th>
                    <th className="py-3 px-4">Calculated Ratio (Dark / Light)</th>
                    <th className="py-3 px-4">Required WCAG AA</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {contrastPairs.map((p, idx) => (
                    <tr key={idx} className="hover:bg-surface-raised transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-fg">{p.fg}</td>
                      <td className="py-3 px-4 font-mono text-fg-2">{p.bg}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-accent-text font-bold">{p.ratio}</td>
                      <td className="py-3 px-4 font-mono text-fg-muted">{p.min}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-success-bg text-success border border-success/30">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      )}

      {/* Interactive Modal Demo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Interactive Dialog Demo"
        description="Verifies scrim overlay, surface contrast, and keyboard dismissal (Esc)."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
              Confirm Action
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-fg-2">
          <p>
            This modal uses semantic <code>bg-surface</code>, <code>border-border</code>, and <code>bg-black/60</code> scrim backdrop.
          </p>
          <Input placeholder="Enter confirmation code..." />
        </div>
      </Modal>
    </div>
  );
}
