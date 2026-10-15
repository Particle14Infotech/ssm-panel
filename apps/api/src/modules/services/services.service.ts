import { Injectable } from "@nestjs/common";
import { ServiceItem } from "@smm/contracts";

@Injectable()
export class ServicesService {
  private services: ServiceItem[] = [
    {
      id: "1042",
      categoryId: "cat_ig",
      categoryName: "Followers",
      name: "Instagram High-Retention Followers [Real Active • 0% Drop • 30D Refill]",
      platform: "INSTAGRAM",
      ratePer1000: 180.0,
      minQty: 100,
      maxQty: 500000,
      avgProcessingSpeed: "10k - 50k / Day",
      avgStartTime: "0 - 15 mins",
      refillable: true,
      cancellable: true,
      description: "Premium algorithmic node distribution with organic drip ramp.",
      status: "ACTIVE",
      badge: "0% Drop Guarantee",
    },
    {
      id: "1045",
      categoryId: "cat_ig",
      categoryName: "Views",
      name: "Instagram Reel Views [Instant Delivery • Ultra Fast • Explore Push]",
      platform: "INSTAGRAM",
      ratePer1000: 22.0,
      minQty: 500,
      maxQty: 5000000,
      avgProcessingSpeed: "500k / Hour",
      avgStartTime: "Instant",
      refillable: false,
      cancellable: true,
      description: "Ultra low-latency dispatch. Triggers high watch-time signals.",
      status: "ACTIVE",
      badge: "Explore Push",
    },
    {
      id: "2015",
      categoryId: "cat_yt",
      categoryName: "Views",
      name: "YouTube High Retention Views [Suggested Videos & Search Traffic]",
      platform: "YOUTUBE",
      ratePer1000: 160.0,
      minQty: 1000,
      maxQty: 10000000,
      avgProcessingSpeed: "50k / Day",
      avgStartTime: "0 - 30 mins",
      refillable: true,
      cancellable: true,
      description: "Multi-geographic organic traffic blending suggested videos.",
      status: "ACTIVE",
      badge: "Organic Search",
    },
    {
      id: "3001",
      categoryId: "cat_tt",
      categoryName: "Views",
      name: "TikTok FYP Targeted Views [Instant Start • Viral Algorithm Trigger]",
      platform: "TIKTOK",
      ratePer1000: 18.0,
      minQty: 1000,
      maxQty: 20000000,
      avgProcessingSpeed: "1M / Hour",
      avgStartTime: "Instant",
      refillable: false,
      cancellable: true,
      description: "Direct FYP simulated traffic vectors. High completion rates.",
      status: "ACTIVE",
      badge: "Viral Push",
    },
    {
      id: "4010",
      categoryId: "cat_tg",
      categoryName: "Members",
      name: "Telegram Channel Members [Non-Drop • 0% Ban • 60D Auto-Refill]",
      platform: "TELEGRAM",
      ratePer1000: 110.0,
      minQty: 100,
      maxQty: 1000000,
      avgProcessingSpeed: "50k / Day",
      avgStartTime: "Instant",
      refillable: true,
      cancellable: true,
      description: "High speed member expansion with organic online status simulators.",
      status: "ACTIVE",
      badge: "60D Refill",
    },
    {
      id: "5001",
      categoryId: "cat_tw",
      categoryName: "Followers",
      name: "X / Twitter Verified NFT/Premium Followers [Organic Boosted]",
      platform: "X_TWITTER",
      ratePer1000: 420.0,
      minQty: 50,
      maxQty: 50000,
      avgProcessingSpeed: "2k / Day",
      avgStartTime: "0 - 30 mins",
      refillable: true,
      cancellable: true,
      description: "Premium X followers with profile bios, avatars, and tweet history.",
      status: "ACTIVE",
      badge: "Crypto / Web3",
    },
  ];

  private categories = [
    { id: "cat_ig", name: "Followers", slug: "instagram-followers" },
    { id: "cat_yt", name: "Views", slug: "youtube-views" },
    { id: "cat_tt", name: "Views", slug: "tiktok-views" },
    { id: "cat_tg", name: "Members", slug: "telegram-members" },
    { id: "cat_tw", name: "Followers", slug: "twitter-followers" },
  ];

  getPlatforms(): string[] {
    return Array.from(new Set(this.services.map((s) => s.platform)));
  }

  getCategories() {
    return this.categories;
  }

  createCategory(input: { name: string; slug?: string }) {
    const newCat = {
      id: `cat_${Math.random().toString(36).substring(2, 7)}`,
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/\s+/g, "-"),
    };
    this.categories.push(newCat);
    return { success: true, category: newCat };
  }

  findAll(platform?: string, query?: string, categoryId?: string, sortBy?: string) {
    let result = [...this.services];
    if (platform && platform !== "ALL") {
      result = result.filter(
        (s) => s.platform.toLowerCase() === platform.toLowerCase()
      );
    }
    if (categoryId) {
      result = result.filter((s) => s.categoryId === categoryId);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }
    if (sortBy === "price_asc") {
      result.sort((a, b) => a.ratePer1000 - b.ratePer1000);
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => b.ratePer1000 - a.ratePer1000);
    }
    return result;
  }

  findOne(id: string) {
    return this.services.find((s) => s.id === id);
  }

  create(input: any) {
    const newService: ServiceItem = {
      id: input.id || String(Math.floor(1000 + Math.random() * 9000)),
      categoryId: input.categoryId || "cat_ig",
      categoryName: input.categoryName || "General",
      name: input.name,
      platform: input.platform || "INSTAGRAM",
      ratePer1000: Number(input.ratePer1000) || 100,
      minQty: Number(input.minQty) || 50,
      maxQty: Number(input.maxQty) || 100000,
      avgProcessingSpeed: input.avgProcessingSpeed || "Standard",
      avgStartTime: input.avgStartTime || "Instant",
      refillable: Boolean(input.refillable),
      cancellable: Boolean(input.cancellable),
      description: input.description || "",
      status: "ACTIVE",
      badge: input.badge,
    };
    this.services.unshift(newService);
    return { success: true, service: newService };
  }

  update(id: string, input: any) {
    const idx = this.services.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.services[idx] = { ...this.services[idx], ...input };
    return { success: true, service: this.services[idx] };
  }

  remove(id: string) {
    const idx = this.services.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.services.splice(idx, 1);
    return true;
  }
}
