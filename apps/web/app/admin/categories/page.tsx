"use client";

import React, { useState } from "react";
import { useAdmin } from "@/context/AdminContext";
import {
  FolderTree,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  Search,
} from "lucide-react";

interface CategoryItem {
  id: string;
  name: string;
  platform: string;
  activeServices: number;
  status: "ACTIVE" | "DISABLED";
}

const INITIAL_CATEGORIES: CategoryItem[] = [
  { id: "cat-01", name: "Instagram — Followers & Growth", platform: "Instagram", activeServices: 14, status: "ACTIVE" },
  { id: "cat-02", name: "Instagram — Reels & Views", platform: "Instagram", activeServices: 8, status: "ACTIVE" },
  { id: "cat-03", name: "TikTok — FYP & Sound Waves", platform: "TikTok", activeServices: 12, status: "ACTIVE" },
  { id: "cat-04", name: "YouTube — Subscribers & Watch Hours", platform: "YouTube", activeServices: 9, status: "ACTIVE" },
  { id: "cat-05", name: "Telegram — Members & Views", platform: "Telegram", activeServices: 6, status: "ACTIVE" },
  { id: "cat-06", name: "X (Twitter) — Retweets & Likes", platform: "X Corp", activeServices: 11, status: "ACTIVE" },
];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>(INITIAL_CATEGORIES);
  const [newCatName, setNewCatName] = useState("");
  const [newPlatform, setNewPlatform] = useState("Instagram");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCategory = () => {
    if (!newCatName) return;
    const newCat: CategoryItem = {
      id: `cat-${Date.now().toString().slice(-4)}`,
      name: newCatName,
      platform: newPlatform,
      activeServices: 0,
      status: "ACTIVE",
    };
    setCategories((prev) => [newCat, ...prev]);
    setNewCatName("");
    setIsAdding(false);
  };

  const toggleStatus = (id: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } : c
      )
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D8EC8D] animate-pulse" />
              <span className="text-xs uppercase tracking-widest font-mono text-[#D8EC8D]">
                Service Taxonomy Engine
              </span>
            </div>
            <h1 className="text-3xl font-light text-white mt-1">Platform Categories</h1>
            <p className="text-xs text-[#c7c8b6] mt-0.5">
              Organize service vectors into customer-facing platform classifications.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 rounded-full btn-primary-gradient text-[#171e00] font-bold text-xs hover:shadow-[0_0_20px_rgba(216,236,141,0.25)] transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>

        {/* Create Category Modal Box */}
        {isAdding && (
          <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">New Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#c7c8b6] block mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Instagram — Verified Comments"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-[#131313] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D8EC8D]/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#c7c8b6] block mb-1">Platform Group</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  className="w-full bg-[#131313] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D8EC8D]/50"
                >
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Telegram">Telegram</option>
                  <option value="X Corp">X (Twitter)</option>
                  <option value="Spotify">Spotify</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-1.5 rounded-full bg-[#201f1f] text-xs text-[#c7c8b6] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-1.5 rounded-full btn-primary-gradient text-[#171e00] font-bold text-xs"
              >
                Save Category
              </button>
            </div>
          </div>
        )}

        {/* Categories Table */}
        <div className="glass-panel rounded-3xl overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65)]">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-[#141414] text-[#c7c8b6] text-[11px] uppercase tracking-wider font-mono border-b border-white/10">
                <th className="py-3 px-4">Category ID</th>
                <th className="py-3 px-4">Category Name</th>
                <th className="py-3 px-4">Platform</th>
                <th className="py-3 px-4 text-center">Active Services</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#c7c8b6]">{c.id}</td>
                  <td className="py-3 px-4 text-white font-medium">{c.name}</td>
                  <td className="py-3 px-4 text-[#D8EC8D]">{c.platform}</td>
                  <td className="py-3 px-4 text-center text-white">{c.activeServices} Services</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleStatus(c.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {c.status}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => toggleStatus(c.id)}
                      className="text-xs text-[#c7c8b6] hover:text-white"
                    >
                      Toggle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
