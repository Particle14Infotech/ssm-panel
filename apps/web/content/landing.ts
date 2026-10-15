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
    name: "SMM PANEL",
    tagline: "Social Media Marketing Platform",
    badge: "Platform Active",
    version: "v4.9 Stable",
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
    badge: "✦ Platform Online",
    headline: "Order social growth services. Track every order.",
    support:
      "One wallet, a clear catalog, live order status. Fulfilled through authorized provider APIs with straightforward delivery tracking.",
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
        label: "Wallet Balance",
        value: "Instant Credit",
        sub: "Direct payment methods",
      },
      {
        label: "Catalog Services",
        value: "500+ Options",
        sub: "Verified provider routing",
      },
      {
        label: "Order Tracking",
        value: "Live Status",
        sub: "Clear progress updates",
      },
    ],
    telemetry: {
      status: "System Active",
      uptime: "99.9%",
      latency: "Real-time",
      activeNodes: "Services Online",
    },
  },
  socialProof: {
    headline: "Built for social creators, marketing teams, and agencies.",
    metrics: [],
    testimonials: [
      {
        quote:
          "Automatic partial refunds for incomplete quantities save our support team hours every week. Clear balance deductions and steady delivery.",
        author: "Marcus Vance",
        role: "Growth Director",
        company: "Vance Media Agency",
        metric: "Agency Partner",
      },
      {
        quote:
          "Straightforward pricing per 1,000 units with instant ledger credits. Clean API documentation and reliable dispatch.",
        author: "Elena Rostova",
        role: "Head of Operations",
        company: "OmniGrowth Labs",
        metric: "API Reseller",
      },
    ],
  },
  benefits: {
    badge: "Platform Standards",
    title: "Three Pillars of Platform Reliability",
    description: "Built around verifiable accounting standards, steady queues, and transparent operations.",
    items: [
      {
        id: "fast",
        title: "Fast",
        subtitle: "Automated Order Processing",
        description:
          "Automated background processing queues deliver orders directly to provider endpoints without delays or manual bottlenecks.",
        badge: "Automated Ingress",
        icon: "zap",
        metrics: [
          { label: "Queue Processing", value: "Dedicated queues" },
          { label: "Status Polling", value: "Automated sync" },
        ],
      },
      {
        id: "secure",
        title: "Secure",
        subtitle: "Protected Wallet Ledger",
        description:
          "Protected password hashing, encrypted provider credentials, rotating user sessions, and double-entry ledger accounting where funds are tracked precisely.",
        badge: "Atomic Ledger",
        icon: "shield-check",
        metrics: [
          { label: "Audit Trails", value: "Append-only DB logs" },
          { label: "Provider Keys", value: "Encrypted at rest" },
        ],
      },
      {
        id: "seo-ready",
        title: "SEO-Ready",
        subtitle: "Fast Catalog Loading",
        description:
          "Server-rendered catalog pages, clean metadata hierarchy, and fast page response times across mobile and desktop devices.",
        badge: "Optimized Performance",
        icon: "sparkles",
        metrics: [
          { label: "Catalog Indexing", value: "Clean category routes" },
          { label: "Edge Response", value: "Fast page delivery" },
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
        serviceName: "Meta Reels High-Retention Views [Steady Delivery]",
        ratePer1000: 70,
        minQty: 100,
        maxQty: 1000000,
        avgSpeed: "50k/day",
        badge: "High Retention",
        description: "High-retention video playback with natural watch duration distribution.",
      },
      {
        id: "tt-sound-02",
        platform: "TIKTOK",
        platformName: "TikTok",
        category: "Sound Engagement",
        serviceName: "TikTok Sound Multiplier [Paced Delivery]",
        ratePer1000: 95,
        minQty: 250,
        maxQty: 500000,
        avgSpeed: "100k/day",
        badge: "Priority Batch",
        description: "Optimized sound cluster delivery across active creator regions.",
      },
      {
        id: "yt-sub-03",
        platform: "YOUTUBE",
        platformName: "YouTube",
        category: "Subscribers & Watch Hours",
        serviceName: "YouTube Channel Subscribers [30 Days Refill Window]",
        ratePer1000: 1450,
        minQty: 50,
        maxQty: 25000,
        avgSpeed: "2k/day",
        badge: "Refill Window",
        description: "Channel subscriber growth with 30-day automated refill coverage.",
      },
      {
        id: "x-eng-04",
        platform: "X_TWITTER",
        platformName: "X (Twitter)",
        category: "Engagement & Reposts",
        serviceName: "X Tweet Engagements & Retweets [Fast Start]",
        ratePer1000: 280,
        minQty: 100,
        maxQty: 50000,
        avgSpeed: "15k/day",
        badge: "Fast Start",
        description: "Social shares, retweets, and bookmark signals from active accounts.",
      },
      {
        id: "tg-mem-05",
        platform: "TELEGRAM",
        platformName: "Telegram",
        category: "Channel Members",
        serviceName: "Telegram Community Members [90-Day Retention]",
        ratePer1000: 175,
        minQty: 100,
        maxQty: 100000,
        avgSpeed: "20k/day",
        badge: "High Retention",
        description: "Public and private channel member delivery with low drop rates.",
      },
    ],
  },
  workWalkthrough: {
    badge: "Operational Pipeline",
    title: "How an order works",
    description: "From wallet deduction to provider synchronization in 5 transparent stages.",
    steps: [
      {
        step: "01",
        title: "Add funds",
        subtitle: "Wallet Top-up",
        description: "Top up your wallet. Any bonus credit is shown before you pay.",
        detail: "Instant balance credit with verified deposit methods and no hidden fees.",
        tag: "1 Add funds",
      },
      {
        step: "02",
        title: "Choose service",
        subtitle: "Platform & Tier Selection",
        description: "Pick a platform and service. Price per 1,000 and min/max quantity are shown up front.",
        detail: "Transparent pricing per 1,000 units and estimated delivery speed.",
        tag: "2 Choose service",
      },
      {
        step: "03",
        title: "Place order",
        subtitle: "Link & Quantity Input",
        description: "Enter your link and quantity. The total is shown before you confirm.",
        detail: "Ledger balance verification prevents overdrafts.",
        tag: "3 Place order",
      },
      {
        step: "04",
        title: "Provider delivers",
        subtitle: "Automated Provider Dispatch",
        description: "The order goes to the provider through their API. Status updates on its own.",
        detail: "Automated queue workers dispatch orders with regular status synchronization.",
        tag: "4 Provider delivers",
      },
      {
        step: "05",
        title: "Complete",
        subtitle: "Fulfillment & Auto-Refunds",
        description: "Completed and partial orders appear in your history. Any undelivered quantity goes back to your wallet.",
        detail: "Automatic balance refund for any cancelled or partial quantities.",
        tag: "5 Complete",
      },
    ],
  },
  pricingTiers: {
    badge: "Transparent Tiers",
    title: "Wallet Deposit Bonus Rules",
    description: "No hidden transaction fees. Automatic bonus credits applied at time of deposit.",
    tiers: [
      {
        name: "Starter",
        description: "Ideal for individual creators testing out catalog services.",
        minDeposit: 100,
        bonusPercent: 0,
        features: [
          "Access to entire 500+ service catalog",
          "Standard processing queue",
          "Full self-service dashboard",
          "Email support ticket response",
        ],
      },
      {
        name: "Growth Tier",
        description: "Designed for scaling brands, influencers, and active creators.",
        minDeposit: 500,
        bonusPercent: 5,
        features: [
          "+5% Bonus credited automatically",
          "Faster queue dispatch",
          "Standard cancel and refill controls",
          "Priority support assistance",
          "CSV bulk order uploads",
        ],
      },
      {
        name: "High Volume Tier",
        description: "For agencies and high-volume accounts requiring maximum deposit value.",
        minDeposit: 1000,
        bonusPercent: 10,
        recommended: true,
        features: [
          "+10% Bonus credited automatically",
          "Personal Reseller API key",
          "Dedicated volume support",
          "Direct webhook notifications",
          "Priority order dispatch",
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
          "Our synchronization system tracks the exact remains count from the provider. If an order finishes as Partial, the system calculates the undelivered amount and automatically credits the exact difference back to your wallet balance.",
      },
      {
        category: "Wallet & Billing",
        question: "Can I withdraw unspent funds from my wallet balance?",
        answer:
          "Deposits are converted into service credits for automated order dispatch. If you have an issue with a specific service, automatic refunds to your internal balance occur immediately.",
      },
      {
        category: "Providers & Compliance",
        question: "What is your compliance posture regarding social platforms?",
        answer:
          "Instagram, YouTube, Telegram, TikTok, Facebook and X are trademarks of their respective owners. This service is not affiliated with or endorsed by them. We operate strictly through authorized provider APIs.",
      },
      {
        category: "API",
        question: "Do you provide an API for automated integrations?",
        answer:
          "Yes. Accounts can access standard API endpoints (services, add, status, balance) with dedicated rate limits and real-time webhook notifications.",
      },
    ],
  },
  contact: {
    badge: "Direct Communication",
    title: "Get in Touch with our Support Team",
    description:
      "Need custom agency integrations, high-volume capacity, or account assistance? Send us a message.",
    email: "support@smmarchitecture.com",
    responsePromise: "Average response time: under 2 hours during active support hours.",
  },
  complianceNotice: {
    title: "Compliance & Operating Standards",
    body: "Instagram, YouTube, Telegram, TikTok, Facebook and X are trademarks of their respective owners. This service is not affiliated with or endorsed by them. All marketing services are fulfilled exclusively via third-party provider APIs.",
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} SMM Architecture. All rights reserved.`,
    description:
      "Social growth management infrastructure. Provider synchronization, ledger accounting, and transparent order tracking. Instagram, YouTube, Telegram, TikTok, Facebook and X are trademarks of their respective owners. This service is not affiliated with or endorsed by them.",
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
