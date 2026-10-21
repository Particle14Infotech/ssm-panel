# Known Limitations & Operating Policies

## 1. Account Ownership & Scope

- **We do not verify account ownership.**
- Packages and per-post triggers operate strictly against user-supplied public profile handles and publicly accessible media links.
- Customers must confirm that they understand platform terms and risks before purchasing any package.
- The panel does not access, store, or solicit private social platform login credentials or OAuth access tokens.

---

## 2. Target Account Privacy & Post Availability

- Target profiles must remain set to **Public** for the duration of delivery.
- If a profile is set to Private, or if a post is deleted after a trigger has been submitted:
  - The SMM panel does not scrape or fetch target URLs directly.
  - When the child order reaches the upstream provider, the provider API will reject or cancel the order.
  - Standard provider failure and retry handling applies: if the provider marks the child order cancelled or failed, the child order charge is refunded to the customer wallet.

---

## 3. Platform Policies & Third-Party Delivery Dynamics

- Social media platforms (Instagram, TikTok, YouTube, Facebook, X, Telegram) maintain independent platform policies, anti-spam mechanisms, and algorithmic filtering.
- Social networks periodically perform routine purges and filter automated interactions.
- Engagement metrics may experience drop-off over time as social networks update ranking algorithms.
- Third-party social networks do not endorse or affiliate with panel delivery services.
- Replacements or refills for post-delivery drop-offs depend strictly on individual provider service terms and are not implied by the package platform engine.

---

## 4. Short-Link and URL Validation Restrictions

- Shortened URL domains (including `vt.tiktok.com`, `youtu.be`, `t.co`, and generic link shorteners) are rejected by offline link validation.
- Only canonical direct links from allowlisted hosts with recognized path structures (such as `/p/`, `/reel/`, `/watch?v=`, `/video/`) are permitted for Start flows.
- This policy ensures reliable media identification and prevents duplicate order dispatches on identical media under differing shortened aliases.
