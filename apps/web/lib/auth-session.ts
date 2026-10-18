"use client";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem("authToken") || localStorage.getItem("token");
  if (local) return local;
  const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}
