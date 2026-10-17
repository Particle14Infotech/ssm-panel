# SMM Panel Overnight Master Polish & Delivery Checklist

## Current Status
- Active Branch: `overnight/polish`
- Execution Mode: Gravitas Autonomous Reliability Runtime
- Priority Order: Phase 0 -> 1 -> 2 -> 3 -> 5 -> 6 -> 8 -> 9 -> 4 -> 7

---

### Phase 0: Source of Truth & Audit
- [x] 0.1 Audit existing design docs (docs/, design-reference/, README, DESIGN.md) -> `done`
- [x] 0.2 Synthesize canonical design system specification -> `DESIGN_SYSTEM.md` -> `done`
- [x] 0.3 Document conflict resolution rules -> `DECISIONS.md` -> `done`
- [x] 0.4 Audit routes, components, 3D stack, bundle size, Lighthouse baseline -> `done`

### Phase 1: Content Cull (High-Signal, No Filler)
- [x] 1.1 Audit and prune landing/public content: remove fake testimonials, unverified stats, fake reviews -> `done`
- [x] 1.2 Remove lorem ipsum, placeholder text, "coming soon" blocks, dead links -> `done`
- [x] 1.3 Ensure lean public structure (Home, Services, Pricing, How It Works, FAQ, Contact, About, Legal) -> `done`
- [x] 1.4 Refine copy: clear, honest, INR pricing, delivery expectations stated without hype words -> `done`

### Phase 2: Remove AI-Look Artifacts
- [x] 2.1 Unicode emoji sweep across all src/, content, UI text, metadata (Zero emoji rule) -> `done`
- [x] 2.2 Add CI/lint check failing on emoji in `src/` -> `done`
- [x] 2.3 Remove glow-beams, text-shadow glow, and neon gradient text from headings -> `done`
- [x] 2.4 Unify tokens: 20-24px radius scale, 8px spacing grid, consistent border and shadow tokens -> `done`

### Phase 3: Real Logos (Platforms & Payment Methods)
- [x] 3.1 Build `<PlatformIcon platform size />` component with optimized local SVGs -> `done`
- [x] 3.2 Build `<PaymentIcon method size />` component with optimized local SVGs -> `done`
- [x] 3.3 Verify all supported platforms & payment methods in catalog & checkout -> `done`
- [x] 3.4 Create `ASSETS.md` documenting logo inventory, sources, and license notes -> `done`

### Phase 5: Responsive (Mobile-First) & Purposeful Scroll Animation
- [x] 5.1 Test and optimize layouts across viewports: 360px, 390px, 768px, 1024px, 1280px, 1536px -> `done`
- [x] 5.2 Ensure tap targets >= 44px, body text >= 16px on mobile, responsive tables and modals -> `done`
- [x] 5.3 Implement lightweight scroll reveals and section animations with `prefers-reduced-motion` support -> `done`

### Phase 6: Performance & 3D Optimization
- [x] 6.1 Lazy-load 3D canvas / mascot / crown stage using dynamic imports with static poster fallbacks -> `done`
- [x] 6.2 Optimize font loading (Poppins Latin subset, swap display) and image assets (Next Image, AVIF/WebP) -> `done`
- [x] 6.3 Eliminate render-blocking resources, prune dead CSS/chunks, verify bundle sizes -> `done`
- [x] 6.4 Produce `PERFORMANCE.md` with baseline vs optimized Lighthouse metrics -> `done`

### Phase 4: Glassmorphism UI Consistency
- [x] 4.1 Apply exact recipe across public, auth, customer, and admin pages -> `done`
- [x] 4.2 Standardize loading skeletons, empty states, error states, and form focus rings -> `done`
- [x] 4.3 Verify tabular-nums, en-IN grouping, and currency formatting on all monetary readouts -> `done`

### Phase 7: SEO & Technical Metadata
- [x] 7.1 Page-level unique titles (<= 60 chars), meta descriptions (<= 155 chars), canonical URLs -> `done`
- [x] 7.2 Structured data (JSON-LD: Organization, WebSite, FAQPage, Service) -> `done`
- [x] 7.3 Generate dynamic `sitemap.ts` and `robots.ts` with noindex on auth/dashboard/admin -> `done`
- [x] 7.4 Dedicated high-value platform service landing pages (Instagram, YouTube, Telegram, TikTok) -> `done`

### Phase 8: QA Gate & Strict Banned-Pattern Scan
- [x] 8.1 TypeScript typecheck, ESLint, unit/integration test suite execution -> `done`
- [x] 8.2 Banned pattern scan: zero emoji, zero lorem ipsum, zero old brand names, zero purple/pink -> `done`
- [x] 8.3 Playwright crawl & axe accessibility verification -> `done`
- [x] 8.4 Generate `QA_REPORT.md` -> `done`

### Phase 9: Deploy & Production Verification (Railway)
- [x] 9.1 Merge `overnight/polish` into `main` after QA gate passes -> `done`
- [x] 9.2 Monitor Railway multi-service deployments (web, api, worker) -> `done`
- [x] 9.3 Perform live smoke testing across health, auth, simulated payment, order lifecycle -> `done`
- [x] 9.4 Finalize `MORNING_REPORT.md` -> `done`

---

## Master Landing Page Cinematic 3D Rebuild (Section-by-Section)
- [x] **Section 1: NAV** — Sticky blur + hairline after 40px, scrollspy strictly inactive at scroll 0, thin lime progress bar, mobile animated drawer (`qa/nav-*.png`) -> `done`
- [x] **Section 2: HERO** — Eyebrow chip, H1 with brand lime accent, plain subtext, CTAs, 3 fact chips, 3D crown stage with orbiting real platform tiles (`qa/hero-*.png`) -> `done`
- [x] **Section 3: PLATFORM STRIP** — Real logos marquee with edge fade masks and hover pause (`qa/platform-strip-*.png`) -> `done`
- [x] **Section 4: STORY** — Pinned 4-step walkthrough with real app previews (/previews/*.png), crossfade animations, side progress rail (`qa/story-*.png`) -> `done`
- [x] **Section 5: PRICE CALCULATOR** — Platform tabs, service selector, quantity slider, live INR rate calculation, "Create account to order" CTA (`qa/calculator-*.png`) -> `done`
- [x] **Section 6: PAYMENTS + WALLET** — Bento grid with large "Pay in INR" tile, official payment plates, "Automatic refunds" tile, "Live tracking" timeline tile with 3D tilt (`qa/payments-*.png`) -> `done`
- [x] **Section 7: FAQ** — 6 real questions, smooth height animated accordion, centered 800px, FAQPage JSON-LD (`qa/faq-*.png`) -> `done`
- [x] **Section 8: FINAL CTA** — Centered large crown stage, "Ready to place your first order?", primary CTA button, soft lime light pool -> `done`
- [x] **Section 9: FOOTER** — Logo, one sentence, 3 link columns, bottom bar, single trademark disclaimer -> `done`
- [x] **Hard QA Invariants** — Playwright assertions verified on 390x844 (mobile), 820x1180 (tablet), 1440x900 (desktop): zero overflow, tap targets >= 44px, exactly 1 canvas, zero console errors, reduced motion compliance -> `done`
