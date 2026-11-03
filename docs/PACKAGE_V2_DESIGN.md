# Package V2 Architecture & Expand-Only Schema Design

**Document:** `docs/PACKAGE_V2_DESIGN.md`  
**Status:** Approved Architecture Draft  
**Scope:** Data models, constraints, allocation arithmetic, and immutable tier versioning.

---

## 1. Core Principles & Schema Rules
1. **Expand-Only Migrations:** No column deletions, renames, type conversions, or non-default `NOT NULL` columns.
2. **Deterministic Pricing & Integer Paise:** All money fields are represented in exact currency units (or Decimal with strict 2-place precision).
3. **Largest Remainder Allocation:** When a fixed combo bundle price is divided across items, runs, or slots, fractional paise remainders are distributed deterministically by largest remainder (ties broken by item ID) so $\sum \text{allocated} \equiv \text{Total Price}$ exactly.
4. **Allocated Share Refunds:** Cancellations and refunds use the stored allocation snapshot (`allocatedCharge`), never the retail catalog price.
5. **Tier Immutability:** Once a `PackageTemplateTier` records `soldCount > 0`, it is permanently immutable. Any administrative edit automatically creates a new version (`version = version + 1`).
6. **Margin Guard:** Both at publish time and at purchase time, if bundle cost exceeds $(1 - \text{marginFloor}) \times \text{price}$, purchase is refused with HTTP 409 Conflict.

---

## 2. Models Specification

### 2.1 Service Extensions & Enums
```prisma
enum ServiceKind {
  LIKES
  VIEWS
  FOLLOWERS
  SUBSCRIBERS
  COMMENTS
  REACH
  IMPRESSIONS
  SHARES
  SAVES
  OTHER
}

// Added to model Service:
// kind        ServiceKind @default(OTHER)
// geoCountry  String?
// geoRegion   String?
```

### 2.2 PlatformConfig Additions
```prisma
// Added to model PlatformConfig:
// labels           Json?    // { profileUrl: "Profile link", postUrl: "Reel / post link" }
// dripIntervals    Int[]    // [1, 2, 4, 8, 12, 24]
// durationChips    Int[]    // [1, 5, 7, 10, 14, 20, 25, 30]
// maxExtraHours    Int      @default(24)
// enabledTabs      String[] @default(["SINGLE", "CUSTOM_DRIP", "COMBOS", "AUTOPILOT"])
```

### 2.3 Package V2 Template & Combo Models
```prisma
enum PackagePricingMode {
  FIXED
  COMPUTED
}

enum PackageMode {
  LEGACY
  TEMPLATE
  CUSTOMIZED
  CUSTOM
}

model PackageTemplate {
  id           String             @id @default(uuid())
  platform     String             @default("INSTAGRAM")
  slug         String             @unique
  name         String
  description  String?
  badge        String?            // e.g. "Popular", "Go-Viral"
  pricingMode  PackagePricingMode @default(FIXED)
  active       Boolean            @default(true)
  archived     Boolean            @default(false)
  displayOrder Int                @default(0)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  tiers PackageTemplateTier[]
}

model PackageTemplateTier {
  id           String          @id @default(uuid())
  templateId   String
  template     PackageTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  version      Int             @default(1)
  name         String          // e.g. "Starter (10k)", "Growth (50k)"
  price        Decimal         @db.Decimal(12, 2)
  durationDays Int             @default(7)
  soldCount    Int             @default(0)
  active       Boolean         @default(true)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  items PackageTemplateItem[]

  @@unique([templateId, version, name])
}

model PackageTemplateItem {
  id           String              @id @default(uuid())
  tierId       String
  tier         PackageTemplateTier @relation(fields: [tierId], references: [id], onDelete: Cascade)
  serviceId    String
  service      Service             @relation(fields: [serviceId], references: [id])
  quantity     Int
  kind         ServiceKind         @default(OTHER)
  allocationBp Int                 @default(0) // Basis points (1/10000th) for pricing allocation
  displayOrder Int                 @default(0)
}

model PackageSlot {
  id              String             @id @default(uuid())
  packageId       String
  package         Package            @relation(fields: [packageId], references: [id], onDelete: Cascade)
  slotNumber      Int                @default(1)
  targetUrl       String?
  mediaKey        String?
  status          String             @default("AVAILABLE") // AVAILABLE, ACTIVE, COMPLETED, CANCELLED
  linkSlotsUsed   Int                @default(0)
  linkSlotsTotal  Int                @default(1)
  swapsUsed       Int                @default(0)
  maxSwaps        Int                @default(2)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  executions PackageExecution[]

  @@unique([packageId, slotNumber])
  @@unique([packageId, mediaKey])
}

model TemplateDailySales {
  id         String   @id @default(uuid())
  tierId     String
  date       String   // YYYY-MM-DD
  count      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([tierId, date])
}

model PricingSettings {
  id               String   @id @default(uuid())
  marginFloor      Decimal  @default(0.15) @db.Decimal(5, 4) // Minimum 15% margin
  defaultMarkup    Decimal  @default(0.30) @db.Decimal(5, 4)
  roundingDecimals Int      @default(2)
  cancellationFee  Decimal  @default(0.00) @db.Decimal(10, 2)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

