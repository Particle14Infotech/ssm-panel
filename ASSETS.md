# SMM Panel Brand & Payment Asset Inventory (Phase 3)

## Overview
This document records the official source, file location, licensing terms, and usage guidelines for all platform logos and payment method badges across the SMM Panel codebase.

All brand and payment assets are stored locally as optimized SVG paths inside:
- `apps/web/components/shared/PlatformIcon.tsx`
- `apps/web/components/shared/PaymentIcon.tsx`

No external hotlinking or AI-generated vector approximations are used.

---

## 1. Social Platform Logos

| Platform | Source | License / Terms | File / Component | Primary Brand Hex |
| :--- | :--- | :--- | :--- | :--- |
| **Instagram** | Simple Icons (`siInstagram`) | CC0 1.0 Universal / Meta Brand Guidelines | `PlatformIcon.tsx` | `#FF0069` (Gradient fallback) |
| **YouTube** | Simple Icons (`siYoutube`) | CC0 1.0 Universal / YouTube Brand Resources | `PlatformIcon.tsx` | `#FF0000` |
| **TikTok** | Simple Icons (`siTiktok`) | CC0 1.0 Universal / ByteDance Brand Assets | `PlatformIcon.tsx` | `#000000` / `#25F4EE` |
| **Telegram** | Simple Icons (`siTelegram`) | CC0 1.0 Universal / Telegram Brand Guidelines | `PlatformIcon.tsx` | `#26A5E4` |
| **X (Twitter)** | Simple Icons (`siX`) | CC0 1.0 Universal / X Brand Toolkit | `PlatformIcon.tsx` | `#FFFFFF` |
| **Facebook** | Simple Icons (`siFacebook`) | CC0 1.0 Universal / Meta Brand Resource Center | `PlatformIcon.tsx` | `#1877F2` |
| **Spotify** | Simple Icons (`siSpotify`) | CC0 1.0 Universal / Spotify Design Guidelines | `PlatformIcon.tsx` | `#1ED760` |
| **LinkedIn** | Simple Icons (`siLinkedin`) | CC0 1.0 Universal / LinkedIn Brand Center | `PlatformIcon.tsx` | `#0A66C2` |
| **Twitch** | Simple Icons (`siTwitch`) | CC0 1.0 Universal / Twitch Brand Guidelines | `PlatformIcon.tsx` | `#9146FF` |

*Note: For any unrecognized platform, `PlatformIcon` renders a clean, neutral text badge formatted with `font-mono text-slate-300 bg-white/10` rather than an invented logo.*

---

## 2. Payment Method Badges

| Method | Source / Standard | License / Terms | Component | Official Hex / Colors |
| :--- | :--- | :--- | :--- | :--- |
| **UPI** | NPCI (National Payments Corporation of India) | NPCI Brand & Design Specification | `PaymentIcon.tsx` | `#097939` (Green) & `#ED752E` (Orange) |
| **RuPay** | NPCI / RuPay Standard | NPCI Brand Specification | `PaymentIcon.tsx` | `#0A3A60` (Navy) & `#F37021` (Orange) |
| **Google Pay** | Simple Icons (`siGooglepay`) | CC0 1.0 Universal / Google Brand Guidelines | `PaymentIcon.tsx` | `#4285F4`, `#34A853`, `#FBBC05`, `#EA4335` |
| **PhonePe** | Simple Icons (`siPhonepe`) | CC0 1.0 Universal / PhonePe Brand Guidelines | `PaymentIcon.tsx` | `#5F259F` (Purple) |
| **Paytm** | Simple Icons (`siPaytm`) | CC0 1.0 Universal / One97 Communications | `PaymentIcon.tsx` | `#002E6E` (Deep Blue) & `#00BAF2` (Cyan) |
| **Visa** | Simple Icons (`siVisa`) | CC0 1.0 Universal / Visa Brand Guidelines | `PaymentIcon.tsx` | `#1A1F71` (Navy) |
| **Mastercard** | Simple Icons (`siMastercard`) | CC0 1.0 Universal / Mastercard Brand Center | `PaymentIcon.tsx` | `#EB001B` & `#F79E1B` |
| **Netbanking** | Local Vector / Lucide (`Building2`) | MIT License | `PaymentIcon.tsx` | `#3B82F6` (Neutral Blue) |
| **Wallets** | Local Vector / Lucide (`Wallet`) | MIT License | `PaymentIcon.tsx` | `#3B82F6` (Neutral Blue) |

---

## 3. 3D & Brand Visual Assets

| Asset | Location | Dimensions | Fallback Mechanism |
| :--- | :--- | :--- | :--- |
| **Crown Mesh Model** | `/public/models/crown.glb` | GLTF/GLB Binary | Static WebP Poster (`/brand/crown@2x.webp`) |
| **Crown Poster High-Res** | `/public/brand/crown@2x.webp` | 1024x1024 WebP | CSS background radial gradient |
| **Crown Poster Standard** | `/public/brand/crown.webp` | 512x512 WebP | CSS background radial gradient |
| **Depth Map** | `/public/brand/crown-depth.webp` | 512x512 WebP | Standard lighting fallback |

All 3D assets are preserved without modification and dynamically imported (`ssr: false`) to avoid blocking First Contentful Paint.
