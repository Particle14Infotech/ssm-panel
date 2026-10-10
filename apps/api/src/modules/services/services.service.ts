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

  findAll(platform?: string) {
    if (!platform || platform === "ALL") return this.services;
    return this.services.filter(
      (s) => s.platform.toLowerCase() === platform.toLowerCase()
    );
  }

  findOne(id: string) {
    return this.services.find((s) => s.id === id);
  }
}
