# Feature & Requirement Traceability Matrix: Batch 2

| # | Feature | SRS Clause | Endpoint / Table / Schema | Test File & Test ID | Evidence File | Status |
|---|---|---|---|---|---|:---:|
| **S** | Security Hardening Gate (GAP 1–5) | SRS §12, §44 | `Package`, `Wallet`, `LedgerEntry` | `package-*-s[0-6].spec.ts` | `20261025-001047-independent-verify-security.txt` | **VERIFIED** |
| **F0.1** | Batch 2 High Level Design | SRS §1.1–§5.6 | `docs/hld/batch2.md` | Doc Review | `docs/hld/batch2.md` | **VERIFIED** |
| **F0.2** | Batch 2 Low Level Design | SRS §1.1–§5.6 | `docs/lld/batch2.md` | Doc Review | `docs/lld/batch2.md` | **VERIFIED** |
| **F0.3** | Traceability Matrix Setup | Architecture Governance | `docs/TRACEABILITY.md` | Doc Review | `docs/TRACEABILITY.md` | **VERIFIED** |
| **F1.1** | Category Navigation (New Order) | SRS §1.1 | `GET /catalog/grouped`, `Category` | `package-catalog-and-favorites-f1.spec.ts` | `20261025-003720-f1-green-catalog-favorites.txt` | **VERIFIED** |
| **F1.2** | Delivery Timeline Chart | SRS §5.6 | `GET /packages/quote` -> `timeline` | `package-catalog-and-favorites-f1.spec.ts` | `20261025-003720-f1-green-catalog-favorites.txt` | **VERIFIED** |
| **F1.3** | Cart Quantity Balance Hint | SRS §5.3 | Client-side cart validator | `package-catalog-and-favorites-f1.spec.ts` | `20261025-003720-f1-green-catalog-favorites.txt` | **VERIFIED** |
| **F1.4** | Favorites (Generic Config JSON) | SRS §5.2 | `POST/GET /favorites`, `Favorite.config` | `package-catalog-and-favorites-f1.spec.ts` | `20261025-003720-f1-green-catalog-favorites.txt` | **VERIFIED** |
| **F2.1** | Package Pause & Resume | SRS §5.4 | `POST /packages/:id/pause`, `/resume` | `package-extensions-f2.spec.ts: Pause & Resume` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.2** | Post-Trigger Link Swap | SRS §5.4 | `POST /packages/:id/triggers/:tid/swap-link` | `package-extensions-f2.spec.ts: Link Swap` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.3** | Safe Delivery Speed-Up | SRS §5.4 | `POST /packages/:id/speed-up` | `package-extensions-f2.spec.ts: Speed-Up Schedule` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.4** | Lock-and-Verify Batch Execution | SRS §1.4.2 | `PackageExecution`, `Worker` | `package-extensions-f2.spec.ts: Lock-and-Verify Batch Chain` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.5** | Order Problem Reporting | SRS §1.5.2 | `POST /orders/:id/report-problem`, `StalledReport` | `package-extensions-f2.spec.ts: Order Problem Report` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.6** | Custom Comments & Sequencing | SRS §2.5 | `POST /packages/:id/comments`, `PackageComment` | `package-extensions-f2.spec.ts: Custom Comments & Sequencing` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.7** | Duration Pricing Tiers | SRS §4.1, §4.2 | `PricingTier`, `Package.tierId` | `package-extensions-f2.spec.ts: Duration Pricing Tiers` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F2.8** | Delivery Window & Geo-Targeting | SRS §1.2, §2.4 | `PackageRule.windowStartHour`, `Intl` | `package-extensions-f2.spec.ts: Geo-Targeting & Deterministic Delivery Window` | `20261025-005415-f2-green-package-extensions.txt` | **VERIFIED** |
| **F3.1** | Preset Package Bundles | SRS §2.2 | `POST /packages/bundle`, `PackageBundleTemplate` | `package-extensions-f3.spec.ts: Preset Package Bundles` | `20261025-005855-f3-green-package-extensions.txt` | **VERIFIED** |
| **F3.2** | Monthly Retainer Auto-Renew | SRS §2.3 | `POST /packages/:id/renew`, `Package.autoRenew` | `package-extensions-f3.spec.ts: Monthly Retainer Auto-Renew` | `20261025-005855-f3-green-package-extensions.txt` | **VERIFIED** |
| **F3.3** | Multi-Provider Failover Routing | SRS §1.4.3, §1.5.1 | `Service.backupProviderId`, `Worker` | `package-extensions-f3.spec.ts: Multi-Provider Failover & Routing` | `20261025-005855-f3-green-package-extensions.txt` | **VERIFIED** |
| **F3.4** | Additional Platform Configs | SRS §1.3 | `PlatformConfig` (LinkedIn, Spotify) | `package-extensions-f3.spec.ts: Extended Platform Configs` | `20261025-005855-f3-green-package-extensions.txt` | **VERIFIED** |
| **GATE** | Final Verification Gate | Reliability Governance | Full Monorepo | `security-gate.js && test:packages` | `20261025-010255-final-batch2-gate.txt` | **VERIFIED** |
