# New Order Gap Analysis & Traceability Matrix

**Audit Date:** 2026-10-29  
**Source Commit:** a52981b  
**Scope:** SPEC Item mapping across Endpoints, Database Tables, UI Components, Feature Flags, Test IDs, and Phased Releases.

---

## Traceability Matrix

| SPEC Item / Feature | Endpoint | DB Table / Model | UI Component | Feature Flag | Test ID | Target Release | Status & Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Expand Schema: Service.kind & Geotargeting** | `GET /services`, `PUT /services/bulk/kinds-and-regions` | `Service.kind`, `geoCountry`, `geoRegion` | `AdminServicesPage.tsx` | `new_order_v2` | `TEST-SC-01` | **R2** | **DONE** (`docs/evidence/20261029T154346Z-r2-gate-and-bootstrap.txt`) |
| **Expand Schema: Package v2 Models** | `GET /package-templates` | `PackageTemplate`, `PackageTemplateTier`, `PackageTemplateItem`, `PackageSlot`, `PackageDraft`, `TemplateDailySales`, `PricingSettings` | `AdminTemplatesPage.tsx` | `tab_combos` | `TEST-SC-02` | **R2** | **DONE** (Expand-only migration `20261029143000`) |
| **Feature Flags Engine & Kill Switch** | `GET /settings/flags`, `PUT /settings/flags/:flagKey`, `POST /settings/flags/:flagKey/kill` | `SystemSetting` | `AdminFlagsPage.tsx` | N/A (Admin) | `TEST-FL-01` | **R2** | **DONE** (`apps/api/src/modules/settings/flags.service.ts`) |
| **Bootstrap API & Kind Filtering** | `GET /new-order/bootstrap?platform=` | `Service`, `PlatformConfig`, `PackageTemplate` | `NewOrderShell.tsx`, `PlatformPicker.tsx` | `new_order_v2` | `TEST-SH-01` | **R2/R3** | **DONE** (`src/modules/orders/new-order-bootstrap.spec.ts`) |
| **Tab 1: Single Order V2** | `POST /orders/quote`, `POST /orders` | `Order`, `OrderRun`, `Service` | `SingleOrderTab.tsx`, `StickySummary.tsx` | `new_order_v2` | `TEST-T1-01` | **R3** | **DONE** (`docs/evidence/20261029T165852Z-r3-shell-and-tab1.txt`) |
| **R4: Pricing Engine & Backend V2** | `POST /packages/custom-campaign/quote`, `POST /packages/custom-campaign`, Admin CRUD `/admin/package-templates` | `Package`, `PackageRule`, `PackageSlot`, `PackageExecution`, `PackageTemplateTier` | N/A (Backend / Admin APIs) | `tab_custom_drip`, `tab_combos` | `TEST-R4-01` | **R4** | **DONE** (`docs/evidence/20261029T174900Z-r4-pricing-engine.txt`) |
| **Tab 2: Custom Drip UI** | `POST /packages/custom-campaign/quote`, `POST /packages/custom-campaign` | `Package`, `PackageRule`, `PackageExecution` | `CustomDripTab.tsx`, `DeliveryChart.tsx` | `tab_custom_drip` | `TEST-T2-01` | **R5** | **DONE** (`docs/evidence/20261029T184500Z-r5-custom-drip.txt`) |
| **Tab 3: Combo Packages** | `GET /packages/templates`, `POST /packages/combos/quote`, `POST /packages/combos` | `PackageTemplate`, `PackageTemplateTier`, `PackageTemplateItem` | `ComboPackagesTab.tsx`, `ComboCard.tsx` | `tab_combos` | `TEST-T3-01` | **R6** | **DONE** (`docs/evidence/20261029T191813Z-r6-combo-packages-and-theme.txt`) |
| **Tab 4: Auto-Pilot (Slots)** | `POST /packages/autopilot`, `POST /packages/slots/:id/start` | `PackageSlot`, `PackageExecution` | `AutoPilotTab.tsx`, `SlotManager.tsx` | `tab_autopilot` | `TEST-T4-01` | **R7** | **DONE** (`docs/evidence/20261029T192709Z-r7-autopilot-and-controls.txt`) |
| **Package Controls (Pause/Resume/Cancel/Swap)** | `POST /packages/:id/pause`, `resume`, `cancel`, `swap-link` | `Package`, `PackageExecution`, `Refund` | `apps/web/app/packages/[id]/page.tsx` | `pkg_controls` | `TEST-PC-01` | **R7** | **DONE** (`docs/evidence/20261029T192709Z-r7-autopilot-and-controls.txt`) |
| **Dashboard V2 (KPIs & Active Links)** | `GET /dashboard/kpis` | `Order`, `Package`, `Wallet` | `apps/web/app/dashboard/page.tsx` | `dashboard_v2` | `TEST-DB-01` | **R7** | **DONE** (Layout & KPIs verified) |
| **Light & Dark Theme Engine** | N/A (Client/CSS tokens) | `User.themePreference` | `ThemeToggle.tsx`, `globals.css` | `theme_light` | `TEST-TH-01` | **R6/R7** | **DONE** (`docs/evidence/20261029T191813Z-r6-combo-packages-and-theme.txt`) |
| **Nightly Reconciler & Margin Reports** | `GET /admin/reconciliation/report`, `GET/PUT /settings/pricing` | `LedgerEntry`, `Wallet`, `Package`, `PricingSettings` | `AdminReconciliationPage.tsx` | N/A (Admin) | `TEST-RC-01` | **R8** | **DONE** (`docs/evidence/20261029T193110Z-r8-admin-pricing-and-reconciler.txt`) |
