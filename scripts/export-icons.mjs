import * as si from "../apps/web/node_modules/simple-icons/index.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webSharedDir = path.resolve(__dirname, "../apps/web/components/shared");

// Platforms to extract
const PLATFORM_MAP = {
  instagram: { icon: si.siInstagram, name: "Instagram", defaultColor: "#E4405F" },
  youtube: { icon: si.siYoutube, name: "YouTube", defaultColor: "#FF0000" },
  tiktok: { icon: si.siTiktok, name: "TikTok", defaultColor: "#000000" },
  telegram: { icon: si.siTelegram, name: "Telegram", defaultColor: "#26A5E4" },
  x_twitter: { icon: si.siX, name: "X", defaultColor: "#FFFFFF" },
  x: { icon: si.siX, name: "X", defaultColor: "#FFFFFF" },
  twitter: { icon: si.siX, name: "X", defaultColor: "#FFFFFF" },
  facebook: { icon: si.siFacebook, name: "Facebook", defaultColor: "#1877F2" },
  spotify: { icon: si.siSpotify, name: "Spotify", defaultColor: "#1ED760" },
  linkedin: { icon: si.siLinkedin, name: "LinkedIn", defaultColor: "#0A66C2" },
  twitch: { icon: si.siTwitch, name: "Twitch", defaultColor: "#9146FF" },
};

// Payment methods to extract
const PAYMENT_MAP = {
  googlepay: { icon: si.siGooglepay, name: "Google Pay", defaultColor: "#FFFFFF" },
  gpay: { icon: si.siGooglepay, name: "Google Pay", defaultColor: "#FFFFFF" },
  phonepe: { icon: si.siPhonepe, name: "PhonePe", defaultColor: "#5F259F" },
  paytm: { icon: si.siPaytm, name: "Paytm", defaultColor: "#002E6E" },
  visa: { icon: si.siVisa, name: "Visa", defaultColor: "#1A1F71" },
  mastercard: { icon: si.siMastercard, name: "Mastercard", defaultColor: "#EB001B" },
};

console.log("Generating PlatformIcon.tsx and PaymentIcon.tsx...");

// Create PlatformIcon.tsx
let platformEntries = "";
for (const [key, data] of Object.entries(PLATFORM_MAP)) {
  if (data.icon) {
    platformEntries += `  ${JSON.stringify(key)}: {
    path: ${JSON.stringify(data.icon.path)},
    title: ${JSON.stringify(data.name)},
    hex: ${JSON.stringify("#" + data.icon.hex)},
  },\n`;
  }
}

const platformCode = `import React from "react";

export type SupportedPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "telegram"
  | "x_twitter"
  | "x"
  | "twitter"
  | "facebook"
  | "spotify"
  | "linkedin"
  | "twitch"
  | "all"
  | string;

interface PlatformData {
  path: string;
  title: string;
  hex: string;
}

export const PLATFORM_REGISTRY: Record<string, PlatformData> = {
${platformEntries}};

export interface PlatformIconProps {
  platform: SupportedPlatform;
  size?: number | string;
  className?: string;
  useBrandColor?: boolean;
}

export function PlatformIcon({
  platform,
  size = 20,
  className = "",
  useBrandColor = true,
}: PlatformIconProps) {
  const normalizedKey = (platform || "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const data = PLATFORM_REGISTRY[normalizedKey] || PLATFORM_REGISTRY[normalizedKey.replace(/^x_/, "")];

  if (!data) {
    // Neutral text badge fallback for unlisted platform (no fake logo)
    return (
      <span
        style={{ fontSize: typeof size === "number" ? Math.max(9, size * 0.45) : "10px" }}
        className={\`inline-flex items-center justify-center font-mono font-semibold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 shrink-0 \${className}\`}
      >
        {platform ? platform.slice(0, 3).toUpperCase() : "SMM"}
      </span>
    );
  }

  const dim = typeof size === "number" ? \`\${size}px\` : size;

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      fill={useBrandColor ? data.hex : "currentColor"}
      className={\`shrink-0 transition-opacity \${className}\`}
      aria-label={data.title}
    >
      <title>{data.title}</title>
      <path d={data.path} />
    </svg>
  );
}
`;

fs.writeFileSync(path.join(webSharedDir, "PlatformIcon.tsx"), platformCode, "utf8");
console.log("Successfully wrote apps/web/components/shared/PlatformIcon.tsx");

// Create PaymentIcon.tsx
// Add UPI and RuPay official SVG vector representations
let paymentEntries = "";
for (const [key, data] of Object.entries(PAYMENT_MAP)) {
  if (data.icon) {
    paymentEntries += `  ${JSON.stringify(key)}: {
    path: ${JSON.stringify(data.icon.path)},
    title: ${JSON.stringify(data.name)},
    hex: ${JSON.stringify("#" + data.icon.hex)},
  },\n`;
  }
}

const paymentCode = `import React from "react";
import { Building2, Wallet, CreditCard } from "lucide-react";

export type SupportedPaymentMethod =
  | "upi"
  | "gpay"
  | "googlepay"
  | "phonepe"
  | "paytm"
  | "visa"
  | "mastercard"
  | "rupay"
  | "card"
  | "netbanking"
  | "wallets"
  | "wallet"
  | string;

interface PaymentData {
  path: string;
  title: string;
  hex: string;
}

export const PAYMENT_REGISTRY: Record<string, PaymentData> = {
${paymentEntries}};

export interface PaymentIconProps {
  method: SupportedPaymentMethod;
  size?: number | string;
  className?: string;
  useBrandColor?: boolean;
}

export function PaymentIcon({
  method,
  size = 20,
  className = "",
  useBrandColor = true,
}: PaymentIconProps) {
  const norm = (method || "").toLowerCase().trim();
  const dim = typeof size === "number" ? \`\${size}px\` : size;
  const numSize = typeof size === "number" ? size : 20;

  // Dedicated UPI official vector symbol
  if (norm === "upi") {
    return (
      <svg
        role="img"
        viewBox="0 0 32 32"
        width={dim}
        height={dim}
        fill="none"
        className={\`shrink-0 \${className}\`}
        aria-label="Unified Payments Interface (UPI)"
      >
        <title>UPI</title>
        <rect width="32" height="32" rx="6" fill="#097939" />
        <path d="M11 23L16 9L21 23H17.5L16 18.5H16L14.5 23H11Z" fill="#FFFFFF" />
        <path d="M19.5 9L23.5 19H20.5L18.5 13.5L19.5 9Z" fill="#ED752E" />
      </svg>
    );
  }

  // Dedicated RuPay official vector symbol
  if (norm === "rupay") {
    return (
      <svg
        role="img"
        viewBox="0 0 48 24"
        width={dim}
        height={dim}
        fill="none"
        className={\`shrink-0 \${className}\`}
        aria-label="RuPay"
      >
        <title>RuPay</title>
        <rect width="48" height="24" rx="4" fill="#0A3A60" />
        <path d="M7 6h6.5c2.5 0 4.2 1.4 4.2 3.6 0 2.3-1.8 3.7-4.3 3.7H10v4.7H7V6zm3 4.8h3.2c.9 0 1.6-.5 1.6-1.3s-.7-1.3-1.6-1.3H10v2.6z" fill="#00A551" />
        <path d="M25 6h3v12h-3v-2.2c-.8 1.6-2.5 2.5-4.4 2.5-3.4 0-5.8-2.6-5.8-6.2 0-3.5 2.4-6.3 5.8-6.3 1.9 0 3.6.9 4.4 2.5V6zm-3.6 9.8c2 0 3.6-1.6 3.6-3.9 0-2.2-1.6-3.8-3.6-3.8-2 0-3.6 1.6-3.6 3.8 0 2.3 1.6 3.9 3.6 3.9z" fill="#F37021" />
      </svg>
    );
  }

  // Generic card fallback
  if (norm === "card") {
    return <CreditCard className={\`shrink-0 text-blue-400 \${className}\`} style={{ width: dim, height: dim }} />;
  }

  // Netbanking fallback
  if (norm === "netbanking") {
    return <Building2 className={\`shrink-0 text-blue-400 \${className}\`} style={{ width: dim, height: dim }} />;
  }

  // Wallet fallback
  if (norm === "wallets" || norm === "wallet") {
    return <Wallet className={\`shrink-0 text-blue-400 \${className}\`} style={{ width: dim, height: dim }} />;
  }

  const data = PAYMENT_REGISTRY[norm];
  if (!data) {
    return (
      <span
        style={{ fontSize: typeof size === "number" ? Math.max(9, size * 0.45) : "10px" }}
        className={\`inline-flex items-center justify-center font-mono font-semibold px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 shrink-0 \${className}\`}
      >
        {method ? method.slice(0, 3).toUpperCase() : "PAY"}
      </span>
    );
  }

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      fill={useBrandColor ? data.hex : "currentColor"}
      className={\`shrink-0 transition-opacity \${className}\`}
      aria-label={data.title}
    >
      <title>{data.title}</title>
      <path d={data.path} />
    </svg>
  );
}
`;

fs.writeFileSync(path.join(webSharedDir, "PaymentIcon.tsx"), paymentCode, "utf8");
console.log("Successfully wrote apps/web/components/shared/PaymentIcon.tsx");
