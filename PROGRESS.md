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
- [ ] 5.1 Test and optimize layouts across viewports: 360px, 390px, 768px, 1024px, 1280px, 1536px -> `doing`
- [ ] 5.2 Ensure tap targets >= 44px, body text >= 16px on mobile, responsive tables and modals -> `todo`
- [ ] 5.3 Implement lightweight scroll reveals and section animations with `prefers-reduced-motion` support -> `todo`

### Phase 6: Performance & 3D Optimization
- [ ] 6.1 Lazy-load 3D canvas / mascot / crown stage using dynamic imports with static poster fallbacks -> `todo`
- [ ] 6.2 Optimize font loading (Poppins Latin subset, swap display) and image assets (Next Image, AVIF/WebP) -> `todo`
- [ ] 6.3 Eliminate render-blocking resources, prune dead CSS/chunks, verify bundle sizes -> `todo`
- [ ] 6.4 Produce `PERFORMANCE.md` with baseline vs optimized Lighthouse metrics -> `todo`

### Phase 4: Glassmorphism UI Consistency
- [ ] 4.1 Apply exact recipe across public, auth, customer, and admin pages -> `todo`
- [ ] 4.2 Standardize loading skeletons, empty states, error states, and form focus rings -> `todo`
- [ ] 4.3 Verify tabular-nums, en-IN grouping, and currency formatting on all monetary readouts -> `todo`

### Phase 7: SEO & Technical Metadata
- [ ] 7.1 Page-level unique titles (<= 60 chars), meta descriptions (<= 155 chars), canonical URLs -> `todo`
- [ ] 7.2 Structured data (JSON-LD: Organization, WebSite, FAQPage) -> `todo`
- [ ] 7.3 Generate dynamic `sitemap.ts` and `robots.ts` with noindex on auth/dashboard/admin -> `todo`
- [ ] 7.4 Dedicated high-value platform service landing pages (Instagram, YouTube, Telegram) -> `todo`

### Phase 8: QA Gate & Strict Banned-Pattern Scan
- [ ] 8.1 TypeScript typecheck, ESLint, unit/integration test suite execution -> `todo`
- [ ] 8.2 Banned pattern scan: zero emoji, zero lorem ipsum, zero old brand names, zero purple/pink -> `todo`
- [ ] 8.3 Playwright crawl & axe accessibility verification -> `todo`
- [ ] 8.4 Generate `QA_REPORT.md` -> `todo`

### Phase 9: Deploy & Production Verification (Railway)
- [ ] 9.1 Merge `overnight/polish` into `main` after QA gate passes -> `todo`
- [ ] 9.2 Monitor Railway multi-service deployments (web, api, worker) -> `todo`
- [ ] 9.3 Perform live smoke testing across health, auth, simulated payment, order lifecycle -> `todo`
- [ ] 9.4 Finalize `MORNING_REPORT.md` -> `todo`
