"use client";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const local = localStorage.getItem("authToken") || localStorage.getItem("token");
  if (local) return local;
  const match = document.cookie.match(/(?:^|;\s*)(?:authToken|token)=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export function getUserRole(): string | null {
  if (typeof window === "undefined") return null;
  const localRole = localStorage.getItem("userRole");
  if (localRole) return localRole;

  const authUserStr = localStorage.getItem("authUser");
  if (authUserStr) {
    try {
      const parsed = JSON.parse(authUserStr);
      if (parsed?.role) return parsed.role;
    } catch {}
  }

  const match = document.cookie.match(/(?:^|;\s*)userRole=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

export async function performUniversalLogout(redirectPath: string = "/?logout=true") {
  if (typeof window === "undefined") return;

  // 1. Wipe client storages completely
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}

  // 2. Clear all auth cookies across multiple path & domain permutations
  const cookiesToClear = ["authToken", "token", "userRole", "refreshToken"];
  const paths = ["/", "/admin", "/app", "/dashboard"];
  const hostname = window.location.hostname;
  const cookieDomains = ["", hostname, `.${hostname}`];

  cookiesToClear.forEach((name) => {
    paths.forEach((p) => {
      cookieDomains.forEach((d) => {
        const domainStr = d ? `; domain=${d}` : "";
        document.cookie = `${name}=; path=${p}${domainStr}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      });
    });
  });

  // 3. Invalidate via server-side Set-Cookie HTTP headers with guaranteed timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timeout);
  } catch {}

  // 4. Force hard reload navigation to target path with logout signal
  window.location.href = redirectPath;
}

