import React from "react";
import { Wallet as WalletIcon } from "lucide-react";

export type SupportedPaymentMethod =
  | "upi"
  | "UPI"
  | "gpay"
  | "googlepay"
  | "phonepe"
  | "paytm"
  | "visa"
  | "mastercard"
  | "rupay"
  | "card"
  | "CARD"
  | "cards"
  | "netbanking"
  | "NETBANKING"
  | "wallets"
  | "wallet"
  | string;

export interface PaymentIconProps {
  method: SupportedPaymentMethod;
  size?: number | string;
  className?: string;
  useBrandColor?: boolean;
}

export function PaymentIcon({
  method,
  size = 24,
  className = "",
  useBrandColor = true,
}: PaymentIconProps) {
  const norm = (method || "").toLowerCase().trim();
  const dim = typeof size === "number" ? `${size}px` : size;

  // 1. UPI (Unified Payments Interface) — Official NPCI Vector Mark
  if (norm === "upi") {
    return (
      <svg
        role="img"
        viewBox="0 0 42 26"
        width={typeof size === "number" ? size * 1.6 : dim}
        height={dim}
        className={`shrink-0 ${className}`}
        aria-label="UPI (Unified Payments Interface)"
      >
        <title>UPI</title>
        {/* Dark container badge with crisp border */}
        <rect width="42" height="26" rx="4" fill="#0c160c" stroke="#1b3a1b" strokeWidth="1" />
        {/* Official UPI Dual Arrows: Left Green, Right Orange */}
        <path d="M12 20.5 L17.5 5.5 L22.5 20.5 H19.2 L17.5 15.5 H15.5 L14 20.5 Z" fill="#00A859" />
        <path d="M21.5 5.5 L25.5 16.5 H22.5 L20.5 11 L21.5 5.5 Z" fill="#F47920" />
        {/* UPI Text */}
        <text
          x="26"
          y="18"
          fill="#FFFFFF"
          fontSize="9.5"
          fontWeight="900"
          fontStyle="italic"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.5px"
        >
          UPI
        </text>
      </svg>
    );
  }

  // 2. MULTI-CARD BADGE: VISA + MASTERCARD + RUPAY
  if (norm === "card" || norm === "cards") {
    return (
      <div className={`flex items-center -space-x-1 shrink-0 ${className}`}>
        {/* Visa Official Vector */}
        <svg viewBox="0 0 32 20" className="h-4 w-5.5 rounded-sm bg-white/[0.08] p-0.5 border border-white/15 shrink-0 shadow-sm">
          <rect width="32" height="20" rx="2" fill="#0f172a" />
          <path
            d="M12.5 14.5L14.2 5.5h2.2l-1.7 9h-2.2zm7.6-8.8c-.4-.2-1.1-.3-2-.3-2.2 0-3.7 1.1-3.7 2.7 0 1.2 1.1 1.9 2 2.3.9.4 1.2.7 1.2 1.1 0 .6-.7.9-1.4.9-.9 0-1.5-.2-2-.5l-.3 1.5c.5.2 1.4.4 2.3.4 2.3 0 3.8-1.1 3.8-2.8 0-1-.6-1.7-1.9-2.3-.8-.4-1.3-.7-1.3-1.1 0-.4.4-.8 1.3-.8.7 0 1.3.1 1.7.3l.3-1.5zm6.5 5.3l1.1-3 .6 3h-1.7zm2.6 3.5h2L29.5 5.5h-1.8c-.4 0-.8.2-.9.6l-3.3 7.9h2.3l.5-1.3h2.8l.2 1.8zm-15.3 0l2.3-5.5-.3-.7c-.4-.7-1.2-1.4-2.2-1.8l1.9 8h-1.7z"
            fill="#1A1F71"
          />
          <path d="M11.6 5.5L7.8 14.5H5.5L8.5 7.2c.2-.5.1-.7-.1-.9-.4-.4-1.4-.8-2.2-1l.1-.3h3.8c.5 0 .9.3 1 .9l.5-1.4z" fill="#00579F" />
          <path d="M6.2 5h.1L8.5 5.5c.2 0 .3.2.3.4L7.3 12.3 5.5 5z" fill="#FAA61A" />
        </svg>

        {/* Mastercard Official Overlapping Circles */}
        <svg viewBox="0 0 30 20" className="h-4 w-5.5 rounded-sm bg-white/[0.08] p-0.5 border border-white/15 shrink-0 shadow-sm">
          <rect width="30" height="20" rx="2" fill="#141414" />
          <circle cx="11" cy="10" r="6" fill="#EB001B" />
          <circle cx="19" cy="10" r="6" fill="#F79E1B" fillOpacity="0.9" />
          <path
            d="M15 5.8a6 6 0 0 1 2 4.2 6 6 0 0 1-2 4.2 6 6 0 0 1 2-4.2z"
            fill="#FF5F00"
          />
        </svg>

        {/* RuPay Official Vector */}
        <svg viewBox="0 0 32 20" className="h-4 w-5.5 rounded-sm bg-white/[0.08] p-0.5 border border-white/15 shrink-0 shadow-sm">
          <rect width="32" height="20" rx="2" fill="#0A3A60" />
          <path d="M7 5h4.5c1.7 0 2.8 1 2.8 2.5s-1.1 2.5-2.8 2.5H9v4H7V5zm2 3.3h2.2c.6 0 1.1-.3 1.1-.9s-.5-.9-1.1-.9H9v1.8z" fill="#00A551" />
          <path d="M19 5h2v8h-2v-1.5c-.5 1-1.6 1.7-2.9 1.7-2.3 0-3.9-1.7-3.9-4.1s1.6-4.2 3.9-4.2c1.3 0 2.4.6 2.9 1.7V5zm-2.4 6.5c1.3 0 2.4-1.1 2.4-2.6s-1.1-2.5-2.4-2.5-2.4 1.1-2.4 2.5 1.1 2.6 2.4 2.6z" fill="#F37021" />
        </svg>
      </div>
    );
  }

  // 3. NETBANKING / IMPS — Official Banking Pillars Vector Icon
  if (norm === "netbanking") {
    return (
      <svg
        viewBox="0 0 32 24"
        width={typeof size === "number" ? Math.round(size * 1.33) : dim}
        height={dim}
        className={`rounded bg-white/[0.06] p-0.5 border border-white/10 shrink-0 ${className}`}
        aria-label="Netbanking & IMPS"
      >
        <title>Netbanking</title>
        <rect width="32" height="24" rx="3" fill="#0f172a" />
        {/* Temple/Bank Roof & Pediment */}
        <polygon points="16,3 4,9 28,9" fill="#D8EC8D" />
        <rect x="4" y="9.5" width="24" height="1.8" fill="#D8EC8D" opacity="0.8" />
        {/* 4 Bank Pillars */}
        <rect x="6.5" y="11.5" width="2.5" height="7" rx="0.5" fill="#FFFFFF" />
        <rect x="11.5" y="11.5" width="2.5" height="7" rx="0.5" fill="#FFFFFF" />
        <rect x="18" y="11.5" width="2.5" height="7" rx="0.5" fill="#FFFFFF" />
        <rect x="23" y="11.5" width="2.5" height="7" rx="0.5" fill="#FFFFFF" />
        {/* Base */}
        <rect x="4" y="19" width="24" height="2" rx="0.5" fill="#D8EC8D" />
      </svg>
    );
  }

  // 4. GOOGLE PAY (GPay)
  if (norm === "gpay" || norm === "googlepay") {
    return (
      <svg role="img" viewBox="0 0 24 24" width={dim} height={dim} className={`shrink-0 ${className}`}>
        <title>Google Pay</title>
        <path d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-2 2.9l3.1 2.4c1.8-1.7 2.8-4.2 2.8-7.1 0-.7-.1-1.4-.2-1.8H12z" fill="#4285F4" />
        <path d="M12 21.6c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.4l-3.2 2.5C2 19.8 6.7 21.6 12 21.6z" fill="#34A853" />
        <path d="M6.6 14.1c-.2-.6-.3-1.3-.3-2.1s.1-1.5.3-2.1V7.4H3.4C2.7 8.8 2.3 10.3 2.3 12s.4 3.2 1.1 4.6l3.2-2.5z" fill="#FBBC05" />
        <path d="M12 6.4c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2 4.2.2 7.4l3.2 2.5c.8-2.3 2.9-4 5.4-4z" fill="#EA4335" />
      </svg>
    );
  }

  // 5. PHONEPE
  if (norm === "phonepe") {
    return (
      <svg role="img" viewBox="0 0 24 24" width={dim} height={dim} className={`shrink-0 ${className}`}>
        <title>PhonePe</title>
        <circle cx="12" cy="12" r="12" fill="#5F259F" />
        <path
          d="M10.2 9.9h2.9v4.7c-.4.2-.9.3-1.3.3-1.1 0-1.6-.5-1.6-1.7V9.9zm7.2-1c0-.5-.4-.9-.9-.9h-1.6L11.2 3.8c-.3-.4-.9-.5-1.4-.4l-1.3.4c-.2.1-.3.3-.1.5l4 3.8H6.4c-.2 0-.3.1-.3.3v.7c0 .5.4.9.9.9h.9v3.2c0 2.4 1.3 3.8 3.4 3.8.7 0 1.2-.1 1.9-.3v2.1c0 .6.5 1.1 1.1 1.1h.9c.2 0 .4-.2.4-.4V9.9h1.5c.2 0 .4-.1.4-.3v-.7z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  // 6. PAYTM
  if (norm === "paytm") {
    return (
      <svg role="img" viewBox="0 0 32 16" width={typeof size === "number" ? size * 1.5 : dim} height={dim} className={`shrink-0 ${className}`}>
        <title>Paytm</title>
        <rect width="32" height="16" rx="3" fill="#002E6E" />
        <text
          x="3"
          y="11.5"
          fill="#00BAF2"
          fontSize="8.5"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.3px"
        >
          Pay<tspan fill="#FFFFFF">tm</tspan>
        </text>
      </svg>
    );
  }

  // 7. VISA (Individual)
  if (norm === "visa") {
    return (
      <svg viewBox="0 0 32 20" width={typeof size === "number" ? size * 1.5 : dim} height={dim} className={`shrink-0 rounded bg-white/[0.06] p-0.5 border border-white/10 ${className}`}>
        <rect width="32" height="20" rx="3" fill="#0f172a" />
        <path
          d="M12.5 14.5L14.2 5.5h2.2l-1.7 9h-2.2zm7.6-8.8c-.4-.2-1.1-.3-2-.3-2.2 0-3.7 1.1-3.7 2.7 0 1.2 1.1 1.9 2 2.3.9.4 1.2.7 1.2 1.1 0 .6-.7.9-1.4.9-.9 0-1.5-.2-2-.5l-.3 1.5c.5.2 1.4.4 2.3.4 2.3 0 3.8-1.1 3.8-2.8 0-1-.6-1.7-1.9-2.3-.8-.4-1.3-.7-1.3-1.1 0-.4.4-.8 1.3-.8.7 0 1.3.1 1.7.3l.3-1.5zm6.5 5.3l1.1-3 .6 3h-1.7zm2.6 3.5h2L29.5 5.5h-1.8c-.4 0-.8.2-.9.6l-3.3 7.9h2.3l.5-1.3h2.8l.2 1.8zm-15.3 0l2.3-5.5-.3-.7c-.4-.7-1.2-1.4-2.2-1.8l1.9 8h-1.7z"
          fill="#00579F"
        />
      </svg>
    );
  }

  // 8. MASTERCARD (Individual)
  if (norm === "mastercard") {
    return (
      <svg viewBox="0 0 30 20" width={typeof size === "number" ? size * 1.5 : dim} height={dim} className={`shrink-0 rounded bg-white/[0.06] p-0.5 border border-white/10 ${className}`}>
        <rect width="30" height="20" rx="3" fill="#141414" />
        <circle cx="11" cy="10" r="6" fill="#EB001B" />
        <circle cx="19" cy="10" r="6" fill="#F79E1B" fillOpacity="0.9" />
        <path
          d="M15 5.8a6 6 0 0 1 2 4.2 6 6 0 0 1-2 4.2 6 6 0 0 1-2-4.2 6 6 0 0 1 2-4.2z"
          fill="#FF5F00"
        />
      </svg>
    );
  }

  // 9. RUPAY (Individual)
  if (norm === "rupay") {
    return (
      <svg viewBox="0 0 32 20" width={typeof size === "number" ? size * 1.5 : dim} height={dim} className={`shrink-0 rounded bg-white/[0.06] p-0.5 border border-white/10 ${className}`}>
        <rect width="32" height="20" rx="3" fill="#0A3A60" />
        <path d="M7 5h4.5c1.7 0 2.8 1 2.8 2.5s-1.1 2.5-2.8 2.5H9v4H7V5zm2 3.3h2.2c.6 0 1.1-.3 1.1-.9s-.5-.9-1.1-.9H9v1.8z" fill="#00A551" />
        <path d="M19 5h2v8h-2v-1.5c-.5 1-1.6 1.7-2.9 1.7-2.3 0-3.9-1.7-3.9-4.1s1.6-4.2 3.9-4.2c1.3 0 2.4.6 2.9 1.7V5zm-2.4 6.5c1.3 0 2.4-1.1 2.4-2.6s-1.1-2.5-2.4-2.5-2.4 1.1-2.4 2.5 1.1 2.6 2.4 2.6z" fill="#F37021" />
      </svg>
    );
  }

  // 10. WALLETS (General)
  if (norm === "wallets" || norm === "wallet") {
    return (
      <div className={`p-1 rounded-lg bg-[#D8EC8D]/10 border border-[#D8EC8D]/30 text-[#D8EC8D] shrink-0 ${className}`}>
        <WalletIcon style={{ width: dim, height: dim }} />
      </div>
    );
  }

  // Default Fallback Badge
  return (
    <span
      style={{
        fontSize: typeof size === "number" ? Math.max(9, size * 0.45) : "10px",
        minWidth: dim,
        height: dim,
      }}
      className={`inline-flex items-center justify-center font-mono font-bold px-1.5 rounded bg-white/10 text-[#D8EC8D] border border-white/10 shrink-0 ${className}`}
    >
      {method ? method.slice(0, 3).toUpperCase() : "PAY"}
    </span>
  );
}
