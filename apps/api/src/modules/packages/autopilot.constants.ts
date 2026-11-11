export interface AutopilotPreset {
  id: "starter_boost" | "viral_push" | "mega_brand";
  name: string;
  badge?: string;
  description: string;
  isRecommended?: boolean;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  runsCount: number;
  durationHours: number;
  pricePerSlot: number;
  pacingSummary: string;
}

export const AUTOPILOT_PRESETS: Record<string, AutopilotPreset> = {
  starter_boost: {
    id: "starter_boost",
    name: "Starter Boost",
    badge: "Fast Start",
    description: "Ideal for fresh uploads & daily consistency. Organic distribution rhythm.",
    metrics: {
      views: 2500,
      likes: 150,
      comments: 20,
      shares: 40,
    },
    runsCount: 4,
    durationHours: 12,
    pricePerSlot: 99,
    pacingSummary: "4 drip batches over 12 hours",
  },
  viral_push: {
    id: "viral_push",
    name: "Viral Push",
    badge: "Recommended",
    isRecommended: true,
    description: "Designed for algorithmic discoverability. Balanced views, engagement, and retention.",
    metrics: {
      views: 10000,
      likes: 600,
      comments: 50,
      shares: 150,
    },
    runsCount: 4,
    durationHours: 12,
    pricePerSlot: 299,
    pacingSummary: "4 drip batches over 12 hours",
  },
  mega_brand: {
    id: "mega_brand",
    name: "Mega Brand",
    badge: "Maximum Impact",
    description: "High-volume sustained push for high-ticket announcements and campaigns.",
    metrics: {
      views: 50000,
      likes: 3000,
      comments: 150,
      shares: 600,
    },
    runsCount: 6,
    durationHours: 24,
    pricePerSlot: 899,
    pacingSummary: "6 drip batches over 24 hours",
  },
};

