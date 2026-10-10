export interface NavItem {
  label: string;
  href: string;
}

export interface BenefitItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  icon: string;
  metrics: { label: string; value: string }[];
}

export interface CatalogPreviewItem {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X_TWITTER" | "TELEGRAM";
  platformName: string;
  category: string;
  serviceName: string;
  ratePer1000: number;
  minQty: number;
  maxQty: number;
  avgSpeed: string;
  badge: string;
  description: string;
}

export interface StepItem {
  step: string;
  title: string;
  subtitle: string;
  description: string;
  detail: string;
  tag: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  category: "Orders" | "Wallet & Billing" | "Providers & Compliance" | "API";
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  company: string;
  metric: string;
}

export interface PricingTierItem {
  name: string;
  description: string;
  minDeposit: number;
  bonusPercent: number;
  features: string[];
  recommended?: boolean;
}

export interface LandingContent {
  brand: {
    name: string;
    tagline: string;
    badge: string;
    version: string;
  };
  navigation: {
    links: NavItem[];
    cta: {
      login: string;
      register: string;
    };
  };
  hero: {
    badge: string;
    headline: string;
    support: string;
    primaryCta: {
      label: string;
      href: string;
    };
    secondaryCta: {
      label: string;
      href: string;
    };
    stats: {
      label: string;
      value: string;
      sub: string;
    }[];
    telemetry: {
      status: string;
      uptime: string;
      latency: string;
      activeNodes: string;
    };
  };
  socialProof: {
    headline: string;
    metrics: { label: string; value: string }[];
    testimonials: TestimonialItem[];
  };
  benefits: {
    badge: string;
    title: string;
    description: string;
    items: BenefitItem[];
  };
  servicesPreview: {
    badge: string;
    title: string;
    description: string;
    items: CatalogPreviewItem[];
  };
  workWalkthrough: {
    badge: string;
    title: string;
    description: string;
    steps: StepItem[];
  };
  pricingTiers: {
    badge: string;
    title: string;
    description: string;
    tiers: PricingTierItem[];
    note: string;
  };
  faq: {
    badge: string;
    title: string;
    description: string;
    items: FaqItem[];
  };
  contact: {
    badge: string;
    title: string;
    description: string;
    email: string;
    responsePromise: string;
  };
  complianceNotice: {
    title: string;
    body: string;
  };
  footer: {
    copyright: string;
    description: string;
    columns: {
      title: string;
      links: { label: string; href: string }[];
    }[];
  };
}

export const landingContent: LandingContent = {
  brand: {
    name: "AETHER SMM",
    tagline: "Autonomous Social Growth Telemetry Engine",
    badge: "Node 08-Alpha Live",
    version: "v4.9 Root Node Optimal",
  },
  navigation: {
    links: [
      { label: "Work", href: "/work" },
      { label: "Services", href: "/services" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
    cta: {
      login: "Sign In",
      register: "Get Started",
    },
  },
  hero: {
    badge: "✦ Algorithmic Telemetry • Node 08-Alpha",
    headline: "Order social growth services. Track every order.",
    support:
      "One wallet, a clear catalog, live order status. Fulfilled through authorized provider APIs with zero guesswork.",
    primaryCta: {
      label: "Create an account",
      href: "/register",
    },
    secondaryCta: {
      label: "Browse services",
      href: "/services",
    },
    stats: [
      {
        label: "Active Engagement Velocity",
        value: "1,422,625",
        sub: "+18.4% events / hr",
      },
      {
        label: "Conversion Resonance",
        value: "98.4%",
        sub: "Tier 1 Provider Routing",
      },
      {
        label: "Cluster Throughput",
        value: "99.98%",
        sub: "Zero dropped packets across outbox",
      },
    ],
    telemetry: {
      status: "Algorithmic Sync Active",
      uptime: "99.98%",
      latency: "14ms",
      activeNodes: "48 / 50 Nodes Online",
    },
  },
  socialProof: {
    headline: "Engineered for high-volume social creators, agencies, and reseller networks.",
    metrics: [
      { label: "Orders Fulfilled", value: "2.4M+" },
      { label: "Integrated Providers", value: "35+" },
      { label: "Avg Delivery Latency", value: "< 45s" },
      { label: "Automated Refund Rate", value: "100%" },
    ],
    testimonials: [
      {
        quote:
          "The outbox relay and automatic partial refunds eliminated 90% of our manual support tickets. The most reliable SMM infrastructure we've connected to.",
        author: "Marcus Vance",
        role: "Growth Director",
        company: "Vance Media Agency",
        metric: "500k+ Monthly Orders",
      },
      {
        quote:
          "Zero money-path race conditions and transparent pricing per 1,000 units. The reseller API documentation and speed are unmatched.",
        author: "Elena Rostova",
        role: "Head of Operations",
        company: "OmniGrowth Labs",
        metric: "99.9% Fulfillment Reliability",
      },
    ],
  },
  benefits: {
    badge: "Architecture & Verification",
    title: "Three Pillars of Platform Integrity",
    description: "Built strictly around verifiable engineering standards and transparent operations.",
    items: [
      {
        id: "fast",
        title: "Fast",
        subtitle: "Queue-Based Async Processing",
        description:
          "BullMQ asynchronous job workers and transactional outbox relay guarantee instant order placement with zero UI blocking or timeout dropped requests.",
        badge: "Under 100ms Ingress",
        icon: "zap",
        metrics: [
          { label: "Worker Concurrency", value: "Dedicated queues" },
          { label: "Status Polling", value: "Automated sync" },
        ],
      },
      {
        id: "secure",
        title: "Secure",
        subtitle: "Ledger-Backed Ledger & Keys",
        description:
          "Argon2id hashing, encrypted AES-256-GCM provider keys, rotating refresh sessions, and strictly transactional ledger accounting where money is never lost.",
        badge: "Zero Race Conditions",
        icon: "shield-check",
        metrics: [
          { label: "Audit Trails", value: "Append-only DB logs" },
          { label: "Provider Keys", value: "AES-256-GCM at rest" },
        ],
      },
      {
        id: "seo-ready",
        title: "SEO-Ready",
        subtitle: "Server-Rendered Catalog & Speed",
        description:
          "Next.js App Router with ISR catalog rendering, schema.org JSON-LD structured data, clean metadata hierarchy, and sub-2.5s LCP performance scores.",
        badge: "100% Core Web Vitals",
        icon: "sparkles",
        metrics: [
          { label: "Catalog Indexing", value: "Full Structured Data" },
          { label: "Edge Response", value: "Global CDN delivery" },
        ],
      },
    ],
  },
  servicesPreview: {
    badge: "Live Service Catalog",
    title: "Transparent, Provider-Synced Services",
    description: "Real-time pricing, explicit minimums/maximums, and instant availability tracking.",
    items: [
      {
        id: "ig-reels-01",
        platform: "INSTAGRAM",
        platformName: "Instagram",
        category: "Reels High-Retention Views",
        serviceName: "Meta Reels High-Retention Vector [Real Accounts • Instant Start]",
        ratePer1000: 0.85,
        minQty: 100,
        maxQty: 1000000,
        avgSpeed: "50k/day",
        badge: "✦ AI Routed",
        description: "High-retention video playback with natural watch duration distribution.",
      },
      {
        id: "tt-sound-02",
        platform: "TIKTOK",
        platformName: "TikTok",
        category: "Sound Wave Multiplier",
        serviceName: "TikTok Sound Wave Multiplier [Organic Pacing • Drip Feed]",
        ratePer1000: 1.2,
        minQty: 250,
        maxQty: 500000,
        avgSpeed: "100k/day",
        badge: "Priority Batch",
        description: "Optimized sound cluster delivery across verified region creators.",
      },
      {
        id: "yt-sub-03",
        platform: "YOUTUBE",
        platformName: "YouTube",
        category: "Subscribers & Watch Hours",
        serviceName: "YouTube Organic Channel Subscribers [30 Days Refill Guarantee]",
        ratePer1000: 18.5,
        minQty: 50,
        maxQty: 25000,
        avgSpeed: "2k/day",
        badge: "Refill Guaranteed",
        description: "Permanent subscribers with 30-day automated refill protection.",
      },
      {
        id: "x-eng-04",
        platform: "X_TWITTER",
        platformName: "X (Twitter)",
        category: "Engagement & Reposts",
        serviceName: "X Tweet Engagements & Verified Retweets [Ultra-Fast]",
        ratePer1000: 3.4,
        minQty: 100,
        maxQty: 50000,
        avgSpeed: "15k/day",
        badge: "Instant Start",
        description: "Algorithm-friendly retweets and bookmark signals from seasoned accounts.",
      },
      {
        id: "tg-mem-05",
        platform: "TELEGRAM",
        platformName: "Telegram",
        category: "Channel Members",
        serviceName: "Telegram Global Community Members [Zero Drop 90-Day]",
        ratePer1000: 2.1,
        minQty: 100,
        maxQty: 100000,
        avgSpeed: "20k/day",
        badge: "Zero Drop",
        description: "High-quality public and private channel subscriber delivery.",
      },
    ],
  },
  workWalkthrough: {
    badge: "Operational Pipeline",
    title: "How Order Fulfillment Works",
    description: "From wallet deduction to provider telemetry synchronization in 4 robust stages.",
    steps: [
      {
        step: "01",
        title: "Catalog Selection & Client Verification",
        subtitle: "Atomic Pricing Calculation",
        description:
          "Select the service, input your public target link, and specify quantity. Price is computed client-side for preview and strictly re-validated on the server.",
        detail: "Validation against min/max limits and dynamic reseller tier markups.",
        tag: "Input Validation",
      },
      {
        step: "02",
        title: "Transactional Wallet Debit & Outbox Event",
        subtitle: "ACID Guaranteed Ledger",
        description:
          "In a single database transaction, the wallet balance is locked, verified, and debited with a unique idempotency key while an outbox record is queued.",
        detail: "SELECT FOR UPDATE prevents any balance overdrafts or concurrency races.",
        tag: "Ledger Invariant",
      },
      {
        step: "03",
        title: "Asynchronous Provider Dispatch",
        subtitle: "BullMQ Outbox Worker Relay",
        description:
          "Our background worker polls outbox events and pushes them to provider APIs using encrypted credentials, circuit breakers, and exponential backoff.",
        detail: "Automatic fallback to secondary priority providers on connection timeouts.",
        tag: "Async Worker",
      },
      {
        step: "04",
        title: "Continuous Telemetry Sync & Auto-Refunds",
        subtitle: "Status & Partial Resolution",
        description:
          "Automated sync jobs track remaining counts. If a provider marks an order Partial or Cancelled, the exact leftover balance is immediately refunded to your wallet.",
        detail: "Refund formula: charge × (remains / quantity) credited to ledger instantly.",
        tag: "Automated Refunds",
      },
    ],
  },
  pricingTiers: {
    badge: "Transparent Tiers",
    title: "Wallet Deposit Bonus Rules",
    description: "Zero hidden transaction fees. Automatic bonus credits applied at time of deposit.",
    tiers: [
      {
        name: "Starter",
        description: "Perfect for individual creators and testing new social vectors.",
        minDeposit: 10,
        bonusPercent: 0,
        features: [
          "Access to entire 500+ service catalog",
          "Standard queue priority",
          "Full self-service dashboard",
          "Standard ticket support",
        ],
      },
      {
        name: "Growth Pro",
        description: "Designed for scaling brands, influencers, and active marketing teams.",
        minDeposit: 100,
        bonusPercent: 5,
        recommended: true,
        features: [
          "+5% Bonus credited automatically",
          "Priority BullMQ queue dispatch",
          "Instant cancel and refill controls",
          "Dedicated priority support",
          "CSV bulk order uploads",
        ],
      },
      {
        name: "Agency & Reseller",
        description: "For high-volume resellers requiring automated API keys and bulk rates.",
        minDeposit: 500,
        bonusPercent: 12,
        features: [
          "+12% Bonus credited automatically",
          "Personal Reseller API key with high rate limits",
          "Custom discounted price per 1k rates",
          "Dedicated Account Manager",
          "Direct Telegram webhook alerts",
        ],
      },
    ],
    note: "Prices vary per service and are updated in real-time according to provider rates.",
  },
  faq: {
    badge: "Knowledge Base",
    title: "Frequently Asked Questions",
    description: "Clear answers on platform mechanics, automated refunds, and compliance.",
    items: [
      {
        category: "Orders",
        question: "How quickly do orders start after placement?",
        answer:
          "Most automated services begin dispatch within 30 to 120 seconds of order submission. Each service in the catalog displays its estimated average start time and speed.",
      },
      {
        category: "Orders",
        question: "What happens if an order is only partially completed?",
        answer:
          "Our synchronization system tracks the exact 'remains' count from the provider. If an order finishes as Partial, the system calculates (Charge × Remains / Total Quantity) and instantly credits the exact difference back to your wallet ledger.",
      },
      {
        category: "Wallet & Billing",
        question: "Can I withdraw unspent funds from my wallet balance?",
        answer:
          "Deposits are converted into service credits for automated order dispatch. If you have an unresolved issue with a specific service, automatic refunds to your internal balance occur immediately.",
      },
      {
        category: "Providers & Compliance",
        question: "What is your compliance posture regarding social platforms?",
        answer:
          "We operate strictly through authorized provider APIs. We do NOT perform credential harvesting, bot account creation, CAPTCHA bypassing, or security circumvention. Service availability depends on provider network conditions, and administrators can disable any service instantly.",
      },
      {
        category: "API",
        question: "Do you provide a Reseller API for automated integrations?",
        answer:
          "Yes. Reseller accounts receive a hashed API key for standard SMM API v2 endpoints (action=services, add, status, balance) with dedicated rate limits and real-time webhook notifications.",
      },
    ],
  },
  contact: {
    badge: "Direct Communication",
    title: "Get in Touch with our Engineering Team",
    description:
      "Need custom agency integrations, high-volume capacity, or technical support? Send us a message.",
    email: "support@aethersmm.internal",
    responsePromise: "Average response time: under 2 hours during active telemetry hours.",
  },
  complianceNotice: {
    title: "Compliance & Operating Standards",
    body: "All marketing services are fulfilled exclusively via third-party provider APIs. We do not engage in unauthorized platform manipulation, bot creation, or account credential capture. Always ensure your marketing campaigns comply with individual platform guidelines.",
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} AETHER SMM Inc. All rights reserved.`,
    description:
      "Enterprise social growth infrastructure. High-frequency provider synchronization, atomic ledger accounting, and transparent order tracking.",
    columns: [
      {
        title: "Platform",
        links: [
          { label: "Live Catalog", href: "/services" },
          { label: "Pricing & Bonuses", href: "/pricing" },
          { label: "How It Works", href: "/work" },
          { label: "Reseller API", href: "/app/api" },
        ],
      },
      {
        title: "Support & Docs",
        links: [
          { label: "Knowledge Base & FAQ", href: "/faq" },
          { label: "Contact Us", href: "/contact" },
          { label: "System Health", href: "/health" },
        ],
      },
      {
        title: "Legal & Policies",
        links: [
          { label: "Terms of Service", href: "/legal/terms" },
          { label: "Privacy Policy", href: "/legal/privacy" },
          { label: "Refund Policy", href: "/legal/refund" },
        ],
      },
    ],
  },
};
