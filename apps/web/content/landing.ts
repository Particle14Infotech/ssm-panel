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
}

export interface CatalogPreviewItem {
  id: string;
  platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "X_TWITTER" | "TELEGRAM" | "FACEBOOK" | "SPOTIFY";
  platformName: string;
  category: string;
  serviceName: string;
  ratePer1000: number;
  minQty: number;
  maxQty: number;
  avgSpeed: string;
  badge?: string;
  description: string;
}

export interface StepItem {
  step: string;
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export interface LandingContent {
  brand: {
    name: string;
    tagline: string;
    badge: string;
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
    accentWord: string;
    support: string;
    primaryCta: {
      label: string;
      href: string;
    };
    secondaryCta: {
      label: string;
      href: string;
    };
    facts: {
      label: string;
      icon: "wallet" | "activity" | "refund";
    }[];
  };
  platforms: {
    id: string;
    name: string;
  }[];
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
  payments: {
    badge: string;
    title: string;
    description: string;
    minDeposit: number;
    methods: { id: string; name: string }[];
  };
  faq: {
    badge: string;
    title: string;
    description: string;
    items: FaqItem[];
  };
  ctaBand: {
    title: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
  contact: {
    badge?: string;
    title: string;
    description: string;
    email: string;
    responsePromise?: string;
    href: string;
  };
  footer: {
    copyright: string;
    description: string;
    trademarkDisclaimer: string;
    columns: {
      title: string;
      links: { label: string; href: string }[];
    }[];
  };
}

export const landingContent: LandingContent = {
  brand: {
    name: "SMM Panel",
    tagline: "Social Media Marketing Platform",
    badge: "Social Media Marketing",
  },
  navigation: {
    links: [
      { label: "Services", href: "/services" },
      { label: "Pricing", href: "/pricing" },
      { label: "How It Works", href: "/work" },
      { label: "FAQ", href: "/faq" },
    ],
    cta: {
      login: "Sign In",
      register: "Get Started",
    },
  },
  hero: {
    badge: "Social Growth Platform",
    headline: "Order social growth. Track every order.",
    accentWord: "Track every order.",
    support:
      "Top up your wallet in INR using UPI or cards, and follow each order live. Any unused balance on cancelled or partial orders automatically returns to your wallet.",
    primaryCta: {
      label: "Create an account",
      href: "/register",
    },
    secondaryCta: {
      label: "Browse services",
      href: "/services",
    },
    facts: [
      {
        label: "Pay in INR via UPI and cards",
        icon: "wallet",
      },
      {
        label: "Live order tracking",
        icon: "activity",
      },
      {
        label: "Automatic wallet refund for undelivered orders",
        icon: "refund",
      },
    ],
  },
  platforms: [
    { id: "instagram", name: "Instagram" },
    { id: "youtube", name: "YouTube" },
    { id: "tiktok", name: "TikTok" },
    { id: "telegram", name: "Telegram" },
    { id: "x", name: "X" },
    { id: "facebook", name: "Facebook" },
    { id: "spotify", name: "Spotify" },
  ],
  benefits: {
    badge: "Why SMM Panel",
    title: "Simple, honest, and reliable",
    description: "Built for creators and agencies who want transparent pricing and automated order fulfillment.",
    items: [
      {
        id: "refunds",
        title: "Automatic refunds",
        subtitle: "Wallet protection on partials",
        description:
          "If an order cannot be fully completed or is cancelled, the unfulfilled amount returns automatically to your wallet balance.",
        badge: "Auto Refunds",
        icon: "refund",
      },
      {
        id: "tracking",
        title: "Live order tracking",
        subtitle: "Clear status at every step",
        description:
          "Check the real-time status of your orders from placement to completion directly from your dashboard.",
        badge: "Live Status",
        icon: "activity",
      },
      {
        id: "support",
        title: "Support tickets",
        subtitle: "Help whenever you need it",
        description:
          "Have a question about an order? Open a support ticket and our team will assist you promptly.",
        badge: "Helpdesk",
        icon: "support",
      },
    ],
  },
  servicesPreview: {
    badge: "Service Catalog",
    title: "Popular services",
    description: "Transparent pricing per 1,000 units with clear start times and quantity limits.",
    items: [
      {
        id: "ig-reels-01",
        platform: "INSTAGRAM",
        platformName: "Instagram",
        category: "Reels Views",
        serviceName: "Reels High-Retention Views",
        ratePer1000: 70,
        minQty: 100,
        maxQty: 1000000,
        avgSpeed: "50k/day",
        description: "High-retention video playback with natural watch duration distribution.",
      },
      {
        id: "tt-sound-02",
        platform: "TIKTOK",
        platformName: "TikTok",
        category: "Sound Engagement",
        serviceName: "Sound Engagement Multiplier",
        ratePer1000: 95,
        minQty: 250,
        maxQty: 500000,
        avgSpeed: "100k/day",
        description: "Optimized sound cluster delivery across active creator regions.",
      },
      {
        id: "yt-sub-03",
        platform: "YOUTUBE",
        platformName: "YouTube",
        category: "Subscribers",
        serviceName: "Channel Subscribers with Refill",
        ratePer1000: 1450,
        minQty: 50,
        maxQty: 25000,
        avgSpeed: "2k/day",
        description: "Channel subscriber growth with 30-day refill window.",
      },
      {
        id: "x-eng-04",
        platform: "X_TWITTER",
        platformName: "X",
        category: "Engagement",
        serviceName: "Post Engagements & Reposts",
        ratePer1000: 280,
        minQty: 100,
        maxQty: 50000,
        avgSpeed: "15k/day",
        description: "Social shares, reposts, and engagement signals.",
      },
      {
        id: "tg-mem-05",
        platform: "TELEGRAM",
        platformName: "Telegram",
        category: "Channel Members",
        serviceName: "Community Channel Members",
        ratePer1000: 175,
        minQty: 100,
        maxQty: 100000,
        avgSpeed: "20k/day",
        description: "Public and private channel member growth.",
      },
    ],
  },
  workWalkthrough: {
    badge: "How It Works",
    title: "Four simple steps",
    description: "Get started in minutes with transparent pricing and live order updates.",
    steps: [
      {
        step: "1",
        title: "Add funds",
        description: "Top up your wallet in INR using UPI, cards, or netbanking.",
      },
      {
        step: "2",
        title: "Choose a service",
        description: "Select your platform and service with clear rates per 1,000 shown upfront.",
      },
      {
        step: "3",
        title: "Place your order",
        description: "Enter your link and quantity, then confirm your order.",
      },
      {
        step: "4",
        title: "Track and get refunds",
        description: "Follow delivery live; any unfulfilled amount automatically returns to your wallet.",
      },
    ],
  },
  payments: {
    badge: "Payments",
    title: "Pay your way",
    description: "Fast and secure deposits in INR with supported payment methods.",
    minDeposit: 100,
    methods: [
      { id: "upi", name: "UPI" },
      { id: "gpay", name: "Google Pay" },
      { id: "phonepe", name: "PhonePe" },
      { id: "paytm", name: "Paytm" },
      { id: "visa", name: "Visa" },
      { id: "mastercard", name: "Mastercard" },
      { id: "rupay", name: "RuPay" },
      { id: "netbanking", name: "Netbanking" },
    ],
  },
  faq: {
    badge: "FAQ",
    title: "Frequently asked questions",
    description: "Straightforward answers about our services, orders, and wallet balance.",
    items: [
      {
        category: "Orders",
        question: "How quickly do orders start after placement?",
        answer:
          "Start times vary by service from instant to a few minutes. Estimated start speed is clearly shown for each service in the catalog.",
      },
      {
        category: "Orders",
        question: "What happens if an order is cancelled or only partially completed?",
        answer:
          "If an order cannot be completed or is only partially fulfilled, the unspent portion is automatically credited back to your wallet balance.",
      },
      {
        category: "Payments",
        question: "Which payment methods are supported for wallet top-ups?",
        answer:
          "We accept INR payments via UPI (Google Pay, PhonePe, Paytm), RuPay, Visa, Mastercard, and Netbanking. Minimum deposit is ₹100.",
      },
      {
        category: "Wallet",
        question: "Can I withdraw unspent funds from my wallet balance?",
        answer:
          "Deposits are converted into service credits for automated order dispatch. If you have an issue with a specific order, automatic refunds return the balance for use on other services.",
      },
      {
        category: "Platforms",
        question: "Which platforms are supported in the catalog?",
        answer:
          "We support services for Instagram, YouTube, TikTok, Telegram, X, Facebook, and Spotify with regular catalog updates.",
      },
      {
        category: "API",
        question: "Do you offer an automated API for orders?",
        answer:
          "Yes, API endpoints are available for authorized accounts to check balances, fetch active services, place orders, and track fulfillment status.",
      },
    ],
  },
  ctaBand: {
    title: "Ready to grow your audience?",
    description: "Create an account, top up your wallet in INR, and start placing orders in minutes.",
    buttonText: "Create an account",
    buttonHref: "/register",
  },
  contact: {
    badge: "Contact",
    title: "Need help or have questions?",
    description: "Our support team is here to assist with custom orders, account queries, and API inquiries.",
    email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "support@smmpanel.com",
    responsePromise: "We typically respond to inquiries within 24 hours.",
    href: "/contact",
  },
  footer: {
    copyright: `© ${new Date().getFullYear()} SMM Panel. All rights reserved.`,
    description:
      "Order social growth services with real-time tracking, transparent INR pricing, and automatic wallet refunds.",
    trademarkDisclaimer:
      "Instagram, YouTube, Telegram, TikTok, Facebook, and X are trademarks of their respective owners. SMM Panel is not affiliated with or endorsed by these platforms.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "Services", href: "/services" },
          { label: "Pricing", href: "/pricing" },
          { label: "How It Works", href: "/work" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "FAQ", href: "/faq" },
          { label: "Contact", href: "/contact" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Terms of Service", href: "/legal/terms" },
          { label: "Privacy Policy", href: "/legal/privacy" },
          { label: "Refund Policy", href: "/legal/refund" },
        ],
      },
    ],
  },
};
