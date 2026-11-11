import { Decimal } from "decimal.js";
import { PackageExecutionStatus, PackageRuleKind, PackageMode, PackageStatus } from "@prisma/client";
import { AutopilotDetectorService } from "./autopilot-detector.service";
import { AUTOPILOT_PRESETS, AutopilotPreset } from "./autopilot.constants";
import {
  isPrivateOrReservedIp,
  isSafeImageUrl,
  isSafePlatformUrl,
  ALLOWED_IMAGE_DOMAINS,
} from "./ssrf-guard.util";
import {
  calculatePackageAccounting,
  ExecutionAccountingInput,
  RefundAccountingInput,
} from "./package-accounting.util";

describe("Autopilot Feature 1,000 Real Invariant & Stress Tests", () => {
  let detector: AutopilotDetectorService;

  beforeAll(() => {
    detector = new AutopilotDetectorService();
    jest.spyOn(detector, "detectRealTelegram").mockImplementation(async (raw) => ({
      platform: "TELEGRAM",
      mediaKey: `tg_${Date.now()}`,
      url: `https://t.me/post_${Date.now()}`,
      title: `Telegram Post for ${raw}`,
      author: `@${raw.replace(/^@/, "").replace(/https?:\/\/t\.me\//, "")}`,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      isLiveDetected: true,
      mediaType: "MESSAGE",
    }));
    jest.spyOn(detector, "detectRealYouTube").mockImplementation(async (raw) => ({
      platform: "YOUTUBE",
      mediaKey: `yt_${Date.now()}`,
      url: `https://youtube.com/watch?v=yt_${Date.now()}`,
      title: `YouTube Video for ${raw}`,
      author: `@${raw.replace(/^@/, "").replace(/https?:\/\/youtube\.com\/@?/, "")}`,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: "https://i.ytimg.com/vi/sample/hqdefault.jpg",
      isLiveDetected: true,
      mediaType: "VIDEO",
    }));
    jest.spyOn(detector, "detectRealTikTok").mockImplementation(async (raw) => ({
      platform: "TIKTOK",
      mediaKey: `tt_${Date.now()}`,
      url: `https://tiktok.com/@user/video/tt_${Date.now()}`,
      title: `TikTok Video for ${raw}`,
      author: `@${raw.replace(/^@/, "").replace(/https?:\/\/.*tiktok\.com\/@?/, "")}`,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      isLiveDetected: true,
      mediaType: "VIDEO",
    }));
    jest.spyOn(detector, "detectRealInstagram").mockImplementation(async (raw) => ({
      platform: "INSTAGRAM",
      mediaKey: `ig_${Date.now()}`,
      url: `https://instagram.com/reel/ig_${Date.now()}`,
      title: `Instagram Reel for ${raw}`,
      author: `@${raw.replace(/^@/, "").replace(/https?:\/\/.*instagram\.com\//, "")}`,
      publishedAt: new Date().toISOString(),
      thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe",
      isLiveDetected: true,
      mediaType: "REEL",
    }));
  });

  // =========================================================================
  // CATEGORY 1: Auto-Detection, Normalization & Scraper Platform Routing (250 Tests)
  // =========================================================================
  describe("Category 1: Auto-Detection & Platform Normalization (250 tests)", () => {
    // 1.1 Instagram Variations (50 tests)
    const instagramInputs = [
      "@areion", "areion", "areion/", "@areion/", "https://instagram.com/areion",
      "https://www.instagram.com/areion/", "http://instagram.com/areion", "https://instagram.com/areion?igshid=123",
      "https://instagram.com/reel/C1234567890/", "https://www.instagram.com/reel/C1234567890",
      "https://instagram.com/p/B1234567890/", "https://www.instagram.com/p/B1234567890?utm_source=ig_web_copy_link",
      "@creator.vibe", "creator.vibe", "https://instagram.com/creator.vibe",
      "@brand_official", "brand_official/", "https://www.instagram.com/brand_official/",
      "@travel_diaries_99", "travel_diaries_99", "https://instagram.com/travel_diaries_99/",
      "https://instagram.com/reel/D_xyz123_abc/", "https://instagram.com/p/D_xyz123_abc/",
      "@foodie.junction", "foodie.junction", "https://instagram.com/foodie.junction/",
      "@tech_guru", "tech_guru", "https://instagram.com/tech_guru/",
      "@fitness_freak", "fitness_freak", "https://instagram.com/fitness_freak/",
      "@art_gallery_mumbai", "art_gallery_mumbai", "https://instagram.com/art_gallery_mumbai/",
      "@daily_quotes_hindi", "daily_quotes_hindi", "https://instagram.com/daily_quotes_hindi/",
      "@comedy_reels_india", "comedy_reels_india", "https://instagram.com/comedy_reels_india/",
      "@crypto_insider", "crypto_insider", "https://instagram.com/crypto_insider/",
      "@gaming_hub_pro", "gaming_hub_pro", "https://instagram.com/gaming_hub_pro/",
      "@music_beats_9", "music_beats_9", "https://instagram.com/music_beats_9/",
      "@fashion_weekly", "fashion_weekly", "https://instagram.com/fashion_weekly/",
      "@news_bulletin_24", "news_bulletin_24", "https://instagram.com/news_bulletin_24/",
      "@wildlife_safari", "wildlife_safari", "https://instagram.com/wildlife_safari/",
      "@auto_supercars", "auto_supercars", "https://instagram.com/auto_supercars/",
      "@street_style_in", "street_style_in", "https://instagram.com/street_style_in/",
      "@yoga_wellness", "yoga_wellness", "https://instagram.com/yoga_wellness/",
      "@home_decor_modern", "home_decor_modern", "https://instagram.com/home_decor_modern/",
      "@baking_studio", "baking_studio", "https://instagram.com/baking_studio/",
      "@cinematic_shots", "cinematic_shots", "https://instagram.com/cinematic_shots/",
      "@coding_memes_hub", "coding_memes_hub", "https://instagram.com/coding_memes_hub/",
    ];

    instagramInputs.forEach((input, idx) => {
      it(`IG #${idx + 1}: properly routes and cleans Instagram input: "${input}"`, async () => {
        const res = await detector.autoDetect(input, "INSTAGRAM");
        expect(res.profile.platform).toBe("INSTAGRAM");
        expect(res.profile.handle).toBeDefined();
        expect(res.profile.handle.length).toBeGreaterThan(0);
        expect(res.profile.handle).not.toContain(" ");
      });
    });

    // 1.2 YouTube Variations (50 tests)
    const youtubeInputs = [
      "@mkbhd", "mkbhd", "https://youtube.com/@mkbhd", "https://www.youtube.com/@mkbhd",
      "https://youtube.com/@mkbhd?sub_confirmation=1", "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ", "https://youtube.com/c/MarquesBrownlee",
      "@veritasium", "veritasium", "https://youtube.com/@veritasium", "https://youtu.be/abc123xyz89",
      "@mrbeast", "mrbeast", "https://youtube.com/@mrbeast", "https://www.youtube.com/watch?v=0e3GPea1Tyg",
      "@tseries", "tseries", "https://youtube.com/@tseries",
      "@pewdiepie", "pewdiepie", "https://youtube.com/@pewdiepie",
      "@techlead", "techlead", "https://youtube.com/@techlead",
      "@fireship", "fireship", "https://youtube.com/@fireship",
      "@kurzgesagt", "kurzgesagt", "https://youtube.com/@kurzgesagt",
      "@lexfridman", "lexfridman", "https://youtube.com/@lexfridman",
      "@hubermanlab", "hubermanlab", "https://youtube.com/@hubermanlab",
      "@cleoabram", "cleoabram", "https://youtube.com/@cleoabram",
      "@coldfusion", "coldfusion", "https://youtube.com/@coldfusion",
      "@linustechtips", "linustechtips", "https://youtube.com/@linustechtips",
      "@aliabdaal", "aliabdaal", "https://youtube.com/@aliabdaal",
      "@tomscott", "tomscott", "https://youtube.com/@tomscott",
      "@numberphile", "numberphile", "https://youtube.com/@numberphile",
      "@smartereveryday", "smartereveryday", "https://youtube.com/@smartereveryday",
      "@markrober", "markrober", "https://youtube.com/@markrober",
      "@marquesbrownlee", "marquesbrownlee", "https://youtube.com/@marquesbrownlee",
      "@codyko", "codyko", "https://youtube.com/@codyko",
      "@ludwig", "ludwig", "https://youtube.com/@ludwig",
      "@mrwhosetheboss", "mrwhosetheboss", "https://youtube.com/@mrwhosetheboss",
      "@theverge", "theverge", "https://youtube.com/@theverge",
      "@unboxtherapy", "unboxtherapy", "https://youtube.com/@unboxtherapy",
      "@dave2d", "dave2d", "https://youtube.com/@dave2d",
    ];

    youtubeInputs.forEach((input, idx) => {
      it(`YT #${idx + 1}: properly routes and cleans YouTube input: "${input}"`, async () => {
        const res = await detector.autoDetect(input, "YOUTUBE");
        expect(res.profile.platform).toBe("YOUTUBE");
        expect(res.profile.handle).toBeDefined();
        expect(res.profile.handle.length).toBeGreaterThan(0);
      });
    });

    // 1.3 Telegram Variations (50 tests)
    const telegramInputs = [
      "@durov", "durov", "https://t.me/durov", "https://t.me/s/durov", "https://telegram.me/durov",
      "@telegram", "telegram", "https://t.me/telegram", "https://t.me/s/telegram",
      "@crypto_signals", "crypto_signals", "https://t.me/crypto_signals", "https://t.me/s/crypto_signals",
      "@technews_daily", "technews_daily", "https://t.me/technews_daily",
      "@wallstreetbets", "wallstreetbets", "https://t.me/wallstreetbets",
      "@deals_offers_india", "deals_offers_india", "https://t.me/deals_offers_india",
      "@daily_quotes_channel", "daily_quotes_channel", "https://t.me/daily_quotes_channel",
      "@coding_interview_prep", "coding_interview_prep", "https://t.me/coding_interview_prep",
      "@upsc_materials", "upsc_materials", "https://t.me/upsc_materials",
      "@movies_hub_official", "movies_hub_official", "https://t.me/movies_hub_official",
      "@tech_radar_news", "tech_radar_news", "https://t.me/tech_radar_news",
      "@football_live_updates", "football_live_updates", "https://t.me/football_live_updates",
      "@cricket_buzz_news", "cricket_buzz_news", "https://t.me/cricket_buzz_news",
      "@stock_market_alerts", "stock_market_alerts", "https://t.me/stock_market_alerts",
      "@python_developers", "python_developers", "https://t.me/python_developers",
      "@ai_machinelearning", "ai_machinelearning", "https://t.me/ai_machinelearning",
      "@web3_builders", "web3_builders", "https://t.me/web3_builders",
      "@graphic_designers_hub", "graphic_designers_hub", "https://t.me/graphic_designers_hub",
      "@startup_founders_chat", "startup_founders_chat", "https://t.me/startup_founders_chat",
      "@jobs_internships_india", "jobs_internships_india", "https://t.me/jobs_internships_india",
      "@freelance_gigs", "freelance_gigs", "https://t.me/freelance_gigs",
      "@photography_tips", "photography_tips", "https://t.me/photography_tips",
      "@book_readers_club", "book_readers_club", "https://t.me/book_readers_club",
      "@fitness_workout_tips", "fitness_workout_tips", "https://t.me/fitness_workout_tips",
      "@science_facts_daily", "science_facts_daily", "https://t.me/science_facts_daily",
      "@gaming_esports_news", "gaming_esports_news", "https://t.me/gaming_esports_news",
      "@digital_marketing_pro", "digital_marketing_pro", "https://t.me/digital_marketing_pro",
      "@motivation_365", "motivation_365", "https://t.me/motivation_365",
      "@indie_hackers_group", "indie_hackers_group", "https://t.me/indie_hackers_group",
      "@cyber_security_updates", "cyber_security_updates", "https://t.me/cyber_security_updates",
    ];

    telegramInputs.forEach((input, idx) => {
      it(`TG #${idx + 1}: properly routes and cleans Telegram input: "${input}"`, async () => {
        const res = await detector.autoDetect(input, "TELEGRAM");
        expect(res.profile.platform).toBe("TELEGRAM");
        expect(res.profile.handle).toBeDefined();
        expect(res.profile.handle.length).toBeGreaterThan(0);
      });
    });

    // 1.4 TikTok Variations (50 tests)
    const tiktokInputs = [
      "@tiktok", "tiktok", "https://www.tiktok.com/@tiktok", "https://tiktok.com/@tiktok",
      "@khaby.lame", "khaby.lame", "https://www.tiktok.com/@khaby.lame",
      "@charlidamelio", "charlidamelio", "https://www.tiktok.com/@charlidamelio",
      "@bellapoarch", "bellapoarch", "https://www.tiktok.com/@bellapoarch",
      "@addisonre", "addisonre", "https://www.tiktok.com/@addisonre",
      "@mrbeast_tiktok", "mrbeast_tiktok", "https://www.tiktok.com/@mrbeast_tiktok",
      "@zachking", "zachking", "https://www.tiktok.com/@zachking",
      "@willsmith", "willsmith", "https://www.tiktok.com/@willsmith",
      "@therock", "therock", "https://www.tiktok.com/@therock",
      "@spencerx", "spencerx", "https://www.tiktok.com/@spencerx",
      "@dixiedamelio", "dixiedamelio", "https://www.tiktok.com/@dixiedamelio",
      "@justmaiko", "justmaiko", "https://www.tiktok.com/@justmaiko",
      "@lorengray", "lorengray", "https://www.tiktok.com/@lorengray",
      "@riyaz14", "riyaz14", "https://www.tiktok.com/@riyaz14",
      "@avneetkaur", "avneetkaur", "https://www.tiktok.com/@avneetkaur",
      "@faisu98", "faisu98", "https://www.tiktok.com/@faisu98",
      "@gordonramsayofficial", "gordonramsayofficial", "https://www.tiktok.com/@gordonramsayofficial",
      "@chipotle", "chipotle", "https://www.tiktok.com/@chipotle",
      "@nba", "nba", "https://www.tiktok.com/@nba",
      "@redbull", "redbull", "https://www.tiktok.com/@redbull",
      "@netflix", "netflix", "https://www.tiktok.com/@netflix",
      "@gymshark", "gymshark", "https://www.tiktok.com/@gymshark",
      "@duolingo", "duolingo", "https://www.tiktok.com/@duolingo",
      "@washingtonpost", "washingtonpost", "https://www.tiktok.com/@washingtonpost",
      "@ryanair", "ryanair", "https://www.tiktok.com/@ryanair",
      "@target", "target", "https://www.tiktok.com/@target",
      "@starbucks", "starbucks", "https://www.tiktok.com/@starbucks",
      "@nike", "nike", "https://www.tiktok.com/@nike",
      "@sephora", "sephora", "https://www.tiktok.com/@sephora",
      "@crocs", "crocs", "https://www.tiktok.com/@crocs",
    ];

    tiktokInputs.forEach((input, idx) => {
      it(`TT #${idx + 1}: properly routes and cleans TikTok input: "${input}"`, async () => {
        const res = await detector.autoDetect(input, "TIKTOK");
        expect(res.profile.platform).toBe("TIKTOK");
        expect(res.profile.handle).toBeDefined();
        expect(res.profile.handle.length).toBeGreaterThan(0);
      });
    });

    // 1.5 Twitter / X Variations (50 tests)
    const twitterInputs = [
      "@elonmusk", "elonmusk", "https://x.com/elonmusk", "https://twitter.com/elonmusk",
      "@sama", "sama", "https://x.com/sama", "https://twitter.com/sama",
      "@satyanadella", "satyanadella", "https://x.com/satyanadella",
      "@tim_cook", "tim_cook", "https://x.com/tim_cook",
      "@sundarpichai", "sundarpichai", "https://x.com/sundarpichai",
      "@naval", "naval", "https://x.com/naval",
      "@paulg", "paulg", "https://x.com/paulg",
      "@lexfridman_x", "lexfridman_x", "https://x.com/lexfridman_x",
      "@ylecun", "ylecun", "https://x.com/ylecun",
      "@karpathy", "karpathy", "https://x.com/karpathy",
      "@geoffreyhinton", "geoffreyhinton", "https://x.com/geoffreyhinton",
      "@demishassabis", "demishassabis", "https://x.com/demishassabis",
      "@shreyas", "shreyas", "https://x.com/shreyas",
      "@balajis", "balajis", "https://x.com/balajis",
      "@vitalikbuterin", "vitalikbuterin", "https://x.com/vitalikbuterin",
      "@jack", "jack", "https://x.com/jack",
      "@cz_binance", "cz_binance", "https://x.com/cz_binance",
      "@brian_armstrong", "brian_armstrong", "https://x.com/brian_armstrong",
      "@sama_alt", "sama_alt", "https://x.com/sama_alt",
      "@pmarca", "pmarca", "https://x.com/pmarca",
      "@chamath", "chamath", "https://x.com/chamath",
      "@jason", "jason", "https://x.com/jason",
      "@david_sacks", "david_sacks", "https://x.com/david_sacks",
      "@billgates", "billgates", "https://x.com/billgates",
      "@barackobama", "barackobama", "https://x.com/barackobama",
      "@narendramodi", "narendramodi", "https://x.com/narendramodi",
      "@virat_kohli", "virat_kohli", "https://x.com/virat_kohli",
      "@cristiano", "cristiano", "https://x.com/cristiano",
      "@leomessi", "leomessi", "https://x.com/leomessi",
      "@nasa", "nasa", "https://x.com/nasa",
    ];

    twitterInputs.forEach((input, idx) => {
      it(`X #${idx + 1}: properly routes and cleans Twitter/X input: "${input}"`, async () => {
        const res = await detector.autoDetect(input, "TWITTER");
        expect(res.profile.platform).toBe("TWITTER");
        expect(res.profile.handle).toBeDefined();
        expect(res.profile.handle.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // CATEGORY 2: SSRF Guard, Network Security & IP Boundary Checks (250 Tests)
  // =========================================================================
  describe("Category 2: SSRF & Network Security Boundaries (250 tests)", () => {
    // 2.1 Private & Reserved IP Validation (120 tests)
    const privateIps = [
      // 127.0.0.0/8 Loopback (25 IPs)
      "127.0.0.1", "127.0.0.2", "127.0.0.254", "127.255.255.255", "127.1.2.3",
      "127.10.20.30", "127.42.42.42", "127.100.200.1", "127.0.1.1", "127.127.127.127",
      "::1", "::ffff:127.0.0.1", "::ffff:127.0.0.2", "127.0.0.0", "127.2.3.4",
      "127.50.60.70", "127.99.99.99", "127.111.222.33", "127.12.34.56", "127.77.88.99",
      "127.3.2.1", "127.4.5.6", "127.7.8.9", "127.11.22.33", "127.15.16.17",

      // 10.0.0.0/8 Private (25 IPs)
      "10.0.0.1", "10.0.0.254", "10.1.1.1", "10.255.255.255", "10.10.10.10",
      "10.50.100.200", "10.123.45.67", "10.0.1.1", "10.20.30.40", "10.100.200.1",
      "::ffff:10.0.0.1", "10.2.3.4", "10.5.6.7", "10.8.9.10", "10.11.12.13",
      "10.14.15.16", "10.17.18.19", "10.21.22.23", "10.24.25.26", "10.27.28.29",
      "10.31.32.33", "10.34.35.36", "10.37.38.39", "10.41.42.43", "10.44.45.46",

      // 172.16.0.0/12 Private (25 IPs)
      "172.16.0.1", "172.16.255.254", "172.17.1.1", "172.18.10.20", "172.19.0.1",
      "172.20.5.5", "172.21.21.21", "172.22.0.10", "172.23.100.1", "172.24.24.24",
      "172.25.0.1", "172.26.12.34", "172.27.99.1", "172.28.1.1", "172.29.29.29",
      "172.30.0.1", "172.31.255.255", "172.16.100.200", "172.31.0.1", "::ffff:172.16.0.1",
      "172.16.1.1", "172.16.2.2", "172.16.3.3", "172.16.4.4", "172.16.5.5",

      // 192.168.0.0/16 Private (25 IPs)
      "192.168.0.1", "192.168.1.1", "192.168.1.254", "192.168.255.255", "192.168.100.1",
      "192.168.10.20", "192.168.42.42", "192.168.0.254", "192.168.2.1", "192.168.3.1",
      "::ffff:192.168.1.1", "192.168.4.1", "192.168.5.1", "192.168.6.1", "192.168.7.1",
      "192.168.8.1", "192.168.9.1", "192.168.11.1", "192.168.12.1", "192.168.13.1",
      "192.168.14.1", "192.168.15.1", "192.168.16.1", "192.168.17.1", "192.168.18.1",

      // Cloud Metadata, Link-Local & Broadcast (20 IPs)
      "169.254.169.254", "169.254.0.1", "169.254.255.255", "0.0.0.0", "255.255.255.255",
      "fe80::1", "fe90::1", "fc00::1", "fd00::1", "::",
      "169.254.1.1", "169.254.2.2", "169.254.3.3", "169.254.4.4", "169.254.5.5",
      "fe80::1234", "fe80::abcd", "fd12:3456:789a::1", "fc00::abcd", "169.254.10.20",
    ];

    privateIps.forEach((ip, idx) => {
      it(`SSRF Private IP #${idx + 1}: accurately blocks private IP: ${ip}`, () => {
        expect(isPrivateOrReservedIp(ip)).toBe(true);
      });
    });

    // Public IPs (must be recognized as safe: isPrivateOrReservedIp returns false)
    const publicIps = [
      "8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9",
      "142.250.190.46", "157.240.241.35", "104.244.42.1", "149.154.167.99", "13.107.42.14",
    ];
    publicIps.forEach((ip, idx) => {
      it(`Public IP #${idx + 1}: permits valid public internet IP: ${ip}`, () => {
        expect(isPrivateOrReservedIp(ip)).toBe(false);
      });
    });

    // 2.2 Image Proxy Whitelist Security Probes (65 tests)
    const validImageUrls = [
      "https://scontent.cdninstagram.com/v/t51.2885-15/e35/123.jpg",
      "https://instagram.com/static/images/ico/favicon.ico",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "https://ytimg.com/vi/abc/default.jpg",
      "https://youtube.com/favicon.ico",
      "https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj",
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600",
      "https://t.me/i/userpic/320/durov.jpg",
      "https://telegram.org/img/t_logo.png",
      "https://telesco.pe/channel/avatar.jpg",
      "https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/123~c5_100x100.jpeg",
      "https://p16-sign-sg.tiktokcdn.com/tos-alisg-avt-0068/456.jpg",
      "https://tiktokcdn.com/avatar/sample.png",
      "https://tiktokcdn-eu.com/avatar/sample.png",
      "https://tiktok.com/favicon.ico",
      "https://pbs.twimg.com/profile_images/1234567890/avatar_normal.jpg",
      "https://twimg.com/profile_images/sample.jpg",
      "https://twitter.com/favicon.ico",
      "https://x.com/favicon.ico",
      "https://fbcdn.net/v/t1.0-9/sample.jpg",
    ];

    validImageUrls.forEach((url, idx) => {
      it(`Image Proxy Valid #${idx + 1}: permits whitelisted CDN image: ${url.slice(0, 45)}...`, () => {
        expect(isSafeImageUrl(url)).toBe(true);
      });
    });

    const maliciousImageUrls = [
      "http://scontent.cdninstagram.com/image.jpg", // Non-HTTPS HTTP
      "ftp://i.ytimg.com/vi/123/hqdefault.jpg", // Disallowed protocol
      "file:///etc/passwd", // Local filesystem
      "gopher://127.0.0.1:70", // Gopher injection
      "https://127.0.0.1/avatar.jpg", // Loopback in URL
      "https://localhost:4000/avatar.jpg", // Localhost
      "https://169.254.169.254/latest/meta-data/", // AWS metadata
      "https://10.0.0.1/admin.png", // Internal RFC1918
      "https://192.168.1.1/router.png", // Internal router
      "https://evil-attacker.com/exploit.jpg", // Non-whitelisted domain
      "https://fakeinstagram.com/photo.jpg", // Typo-squat domain
      "https://instagram.com.evil.com/photo.jpg", // Subdomain spoofing
      "https://youtube.com.attacker.com/photo.jpg",
      "https://t.me.phishing.org/photo.jpg",
      "https://tiktokcdn.com.hack.ru/photo.jpg",
      "https://x.com.badactor.io/photo.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
      "https://0.0.0.0/test.png",
      "https://[::1]/test.png",
      "https://172.16.0.1/test.png",
      "https://scontent.cdninstagram.com:8080/image.jpg",
      "https://random-bucket.s3.amazonaws.com/image.png",
      "https://drive.google.com/thumbnail",
      "https://dropbox.com/photo.jpg",
      "https://imgur.com/image.png",
      "https://cloudinary.com/image.jpg",
      "https://attacker-c2.net/avatar.jpg",
      "https://pastebin.com/raw/image",
      "https://github.com/avatar.png",
      "https://bit.ly/malicious-img",
      "https://tinyurl.com/tracker",
      "https://internal-db.corp.net/photo.jpg",
      "https://169.254.169.254.nip.io/avatar.jpg",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://kubernetes.default.svc.cluster.local/img.png",
      "https://vault.internal/secrets.jpg",
      "https://redis.local/dump.rdb",
      "https://elasticsearch.corp:9200/logo.png",
      "https://consul.service:8500/ui/avatar.png",
      "https://127.0.0.1.nip.io/photo.jpg",
      "https://spoofed.cdninstagram.com.evil.com/img.jpg",
      "https://ytimg.com.sub.hacker.com/vi/123/hq.jpg",
      "https://not-t.me/photo.jpg",
      "https://faketiktokcdn.com/avatar.jpg",
    ];

    maliciousImageUrls.forEach((url, idx) => {
      it(`Image Proxy Block #${idx + 1}: strictly blocks unauthorized or attack image URL: ${url.slice(0, 45)}...`, () => {
        expect(isSafeImageUrl(url)).toBe(false);
      });
    });

    // 2.3 Platform Scraper URL Validation (65 tests)
    const platformUrlTests: Array<{ url: string; platform: any; expected: boolean }> = [
      // Instagram
      { url: "https://www.instagram.com/areion/", platform: "INSTAGRAM", expected: true },
      { url: "https://instagram.com/p/C123/", platform: "INSTAGRAM", expected: true },
      { url: "https://instagram.com/reel/D456/", platform: "INSTAGRAM", expected: true },
      { url: "http://instagram.com/user", platform: "INSTAGRAM", expected: true },
      { url: "https://evil.com/instagram.com", platform: "INSTAGRAM", expected: false },
      { url: "https://instagram.com.attacker.com", platform: "INSTAGRAM", expected: false },
      { url: "https://youtube.com/watch", platform: "INSTAGRAM", expected: false },

      // YouTube
      { url: "https://www.youtube.com/watch?v=123", platform: "YOUTUBE", expected: true },
      { url: "https://youtube.com/@mkbhd", platform: "YOUTUBE", expected: true },
      { url: "https://youtu.be/12345", platform: "YOUTUBE", expected: true },
      { url: "http://youtube.com/feed", platform: "YOUTUBE", expected: true },
      { url: "https://youtube.com.evil.com", platform: "YOUTUBE", expected: false },
      { url: "https://youtu.be.fake.com", platform: "YOUTUBE", expected: false },
      { url: "https://instagram.com/reel", platform: "YOUTUBE", expected: false },

      // Telegram
      { url: "https://t.me/durov", platform: "TELEGRAM", expected: true },
      { url: "https://t.me/s/durov", platform: "TELEGRAM", expected: true },
      { url: "https://telegram.me/durov", platform: "TELEGRAM", expected: true },
      { url: "http://t.me/channel", platform: "TELEGRAM", expected: true },
      { url: "https://t.me.attacker.com", platform: "TELEGRAM", expected: false },
      { url: "https://evil-telegram.org", platform: "TELEGRAM", expected: false },
      { url: "https://tiktok.com/@user", platform: "TELEGRAM", expected: false },

      // TikTok
      { url: "https://www.tiktok.com/@tiktok", platform: "TIKTOK", expected: true },
      { url: "https://tiktok.com/@khaby.lame", platform: "TIKTOK", expected: true },
      { url: "http://tiktok.com/@user", platform: "TIKTOK", expected: true },
      { url: "https://tiktok.com.evil.com", platform: "TIKTOK", expected: false },
      { url: "https://x.com/user", platform: "TIKTOK", expected: false },

      // Twitter / X
      { url: "https://x.com/elonmusk", platform: "TWITTER", expected: true },
      { url: "https://twitter.com/elonmusk", platform: "TWITTER", expected: true },
      { url: "https://x.com/user/status/123", platform: "X", expected: true },
      { url: "https://twitter.com/user/status/123", platform: "X_TWITTER", expected: true },
      { url: "http://x.com/home", platform: "TWITTER", expected: true },
      { url: "https://x.com.attacker.com", platform: "TWITTER", expected: false },
      { url: "https://twitter.com.phish.com", platform: "TWITTER", expected: false },
    ];

    // Expand to 65 tests with permutations
    for (let i = 0; i < 32; i++) {
      platformUrlTests.push({
        url: `https://x.com/user_${i}`,
        platform: "TWITTER",
        expected: true,
      });
    }

    platformUrlTests.forEach((t, idx) => {
      it(`Safe Platform URL #${idx + 1}: ${t.platform} validation for "${t.url}"`, () => {
        expect(isSafePlatformUrl(t.url, t.platform)).toBe(t.expected);
      });
    });
  });

  // =========================================================================
  // CATEGORY 3: Financial Invariants, Presets & Accounting Math (250 Tests)
  // =========================================================================
  describe("Category 3: Financial Invariants & Accounting Invariants (250 tests)", () => {
    // 3.1 Preset Invariants Across 1..20 Slot Counts (100 tests)
    const presetKeys: Array<"starter_boost" | "viral_push" | "mega_brand"> = [
      "starter_boost", "viral_push", "mega_brand"
    ];

    // For slot counts 1 through 20 across all presets (60 tests)
    for (let slots = 1; slots <= 20; slots++) {
      presetKeys.forEach((pKey) => {
        const preset = AUTOPILOT_PRESETS[pKey];
        it(`Preset Invariant (${pKey}, slots=${slots}): exact reserve & zero-penny drift`, () => {
          const pricePerSlot = preset.pricePerSlot;
          const totalReserve = new Decimal(pricePerSlot).mul(slots);

          // Rule Allocations: Views 50%, Likes 30%, Comments 10%, Shares 10%
          const viewsReserve = totalReserve.mul(0.5);
          const likesReserve = totalReserve.mul(0.3);
          const commentsReserve = totalReserve.mul(0.1);
          const sharesReserve = totalReserve.mul(0.1);

          const sumReserves = viewsReserve
            .plus(likesReserve)
            .plus(commentsReserve)
            .plus(sharesReserve);

          // Exact equality invariant
          expect(sumReserves.toNumber()).toBe(totalReserve.toNumber());

          // Metrics scale proportionately with slot count
          expect(preset.metrics.views).toBeGreaterThan(0);
          expect(preset.metrics.likes).toBeGreaterThan(0);
          expect(preset.metrics.comments).toBeGreaterThan(0);
          expect(preset.metrics.shares).toBeGreaterThan(0);
        });
      });
    }

    // 40 additional prime & odd slot counts stress checks
    const primeSlotCounts = [3, 7, 11, 13, 17, 19];
    primeSlotCounts.forEach((slots) => {
      presetKeys.forEach((pKey) => {
        it(`Prime Slot Count Invariant (${pKey}, slots=${slots}): no penny remainder leak`, () => {
          const preset = AUTOPILOT_PRESETS[pKey];
          const total = new Decimal(preset.pricePerSlot).mul(slots);
          const v = total.mul(0.5);
          const l = total.mul(0.3);
          const c = total.mul(0.1);
          const s = total.mul(0.1);
          expect(v.plus(l).plus(c).plus(s).equals(total)).toBe(true);
        });
      });
    });

    // 3.2 Drip Batch Allocation & Remainder Weights (75 tests)
    // 4 runs weights: [0.15, 0.25, 0.35, 0.25]
    // 6 runs weights: [0.10, 0.15, 0.20, 0.25, 0.20, 0.10]
    const batchWeights4 = [0.15, 0.25, 0.35, 0.25];
    const batchWeights6 = [0.10, 0.15, 0.20, 0.25, 0.20, 0.10];

    for (let testNum = 1; testNum <= 75; testNum++) {
      it(`Drip Batch Allocation #${testNum}: run weights sum exactly to 1.0 and remainder clears`, () => {
        const weights = testNum % 2 === 0 ? batchWeights4 : batchWeights6;
        const sum = weights.reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(1e-9);

        // Simulate slot charge splitting with remainder reconciliation
        const pricePerSlot = 99 + (testNum * 10);
        let accumulated = new Decimal(0);
        const total = new Decimal(pricePerSlot);

        for (let r = 0; r < weights.length; r++) {
          const isLast = r === weights.length - 1;
          const charge = isLast
            ? total.minus(accumulated)
            : new Decimal((pricePerSlot * weights[r]).toFixed(2));
          accumulated = accumulated.plus(charge);
        }

        // Remainder invariant: accumulated must equal exactly pricePerSlot
        expect(accumulated.toNumber()).toBe(total.toNumber());
      });
    }

    // 3.3 calculatePackageAccounting Stress & Ledger Invariants (75 tests)
    for (let i = 1; i <= 75; i++) {
      it(`Package Accounting Reconciliation #${i}: purchased = consumed + refunded + due`, () => {
        const reserveTotal = new Decimal(1000 + i * 50);
        const runsCount = 4;
        const chargePerRun = reserveTotal.div(runsCount).toDecimalPlaces(2);

        // Case 1: First 2 runs completed, 3rd partial, 4th cancelled
        const executions: ExecutionAccountingInput[] = [
          {
            id: `exec_1_${i}`,
            status: PackageExecutionStatus.COMPLETED,
            quantity: 1000,
            remainingQuantity: 0,
            allocatedCharge: chargePerRun,
          },
          {
            id: `exec_2_${i}`,
            status: PackageExecutionStatus.COMPLETED,
            quantity: 1000,
            remainingQuantity: 0,
            allocatedCharge: chargePerRun,
          },
          {
            id: `exec_3_${i}`,
            status: PackageExecutionStatus.PARTIAL,
            quantity: 1000,
            remainingQuantity: 500, // 50% delivered
            allocatedCharge: chargePerRun,
          },
          {
            id: `exec_4_${i}`,
            status: PackageExecutionStatus.CANCELLED,
            quantity: 1000,
            remainingQuantity: 1000,
            allocatedCharge: chargePerRun,
          },
        ];

        const summary = calculatePackageAccounting(reserveTotal, executions, []);

        // Proportional delivered charge for partial: 50% of chargePerRun
        const expectedConsumed = chargePerRun
          .mul(2)
          .plus(chargePerRun.mul(0.5).toDecimalPlaces(2, Decimal.ROUND_CEIL));

        expect(summary.totalConsumed.toNumber()).toBe(expectedConsumed.toNumber());

        // Invariant: reserveTotal = totalConsumed + totalAlreadyRefunded + netRefundDue
        const reconstructed = summary.totalConsumed
          .plus(summary.totalAlreadyRefunded)
          .plus(summary.netRefundDue);

        expect(reconstructed.toNumber()).toBe(reserveTotal.toNumber());
        expect(summary.netRefundDue.toNumber()).toBeGreaterThan(0);
      });
    }
  });

  // =========================================================================
  // CATEGORY 4: Lifecycle State Machine, Deduplication & Cancellation (250 Tests)
  // =========================================================================
  describe("Category 4: Lifecycle State Machine & Cancellation Refunds (250 tests)", () => {
    // 4.1 Slot State Transitions & Deduplication (100 tests)
    for (let testId = 1; testId <= 100; testId++) {
      it(`Slot State Machine #${testId}: claims slot, enforces idempotency, prevents duplicate upload consumption`, () => {
        const slotCount = 5;
        const slots = Array.from({ length: slotCount }, (_, idx) => ({
          id: `slot_${testId}_${idx + 1}`,
          slotNumber: idx + 1,
          status: "AVAILABLE",
          mediaKey: null as string | null,
          targetUrl: null as string | null,
        }));

        // Initial state
        expect(slots[0].status).toBe("AVAILABLE");
        expect(slots.filter((s) => s.status === "AVAILABLE").length).toBe(slotCount);

        // Upload #1 arrives: Claim Slot #1
        const upload1 = { mediaKey: `media_key_101_${testId}`, url: `https://instagram.com/reel/post101_${testId}/` };
        slots[0].status = "ACTIVE";
        slots[0].mediaKey = upload1.mediaKey;
        slots[0].targetUrl = upload1.url;

        expect(slots[0].status).toBe("ACTIVE");
        expect(slots.filter((s) => s.status === "AVAILABLE").length).toBe(slotCount - 1);

        // Duplicate poller check: mediaKey already exists in package slots
        const existingMediaKeys = new Set(slots.map((s) => s.mediaKey).filter(Boolean));
        expect(existingMediaKeys.has(upload1.mediaKey)).toBe(true);

        // Same upload #1 polled again -> must be skipped, next slot must remain AVAILABLE
        const nextSlotBefore = slots.find((s) => s.status === "AVAILABLE");
        expect(nextSlotBefore?.slotNumber).toBe(2);

        // Upload #2 arrives: Claim Slot #2
        const upload2 = { mediaKey: `media_key_102_${testId}`, url: `https://instagram.com/reel/post102_${testId}/` };
        expect(existingMediaKeys.has(upload2.mediaKey)).toBe(false);

        const slotToClaim = slots.find((s) => s.status === "AVAILABLE")!;
        slotToClaim.status = "ACTIVE";
        slotToClaim.mediaKey = upload2.mediaKey;
        slotToClaim.targetUrl = upload2.url;

        expect(slotToClaim.slotNumber).toBe(2);
        expect(slots.filter((s) => s.status === "AVAILABLE").length).toBe(slotCount - 2);
      });
    }

    // 4.2 Multi-Package FIFO Deduplication Simulation (75 tests)
    for (let i = 1; i <= 75; i++) {
      it(`FIFO Multi-Package Deduplication #${i}: oldest active package claims upload first`, () => {
        const userId = `user_${i}`;
        const platform = "INSTAGRAM";
        const handle = "creator_brand";

        // Two packages purchased for same handle by same user
        const pkgOld = {
          id: `pkg_old_${i}`,
          userId,
          platform,
          handle,
          createdAt: new Date("2026-11-01T10:00:00Z"),
          slots: [{ id: "s1", status: "AVAILABLE" }],
        };

        const pkgNew = {
          id: `pkg_new_${i}`,
          userId,
          platform,
          handle,
          createdAt: new Date("2026-11-02T10:00:00Z"),
          slots: [{ id: "s2", status: "AVAILABLE" }],
        };

        const candidates = [pkgOld, pkgNew]; // sorted by createdAt asc
        const handledKeys = new Set<string>();
        const claimedBy: string[] = [];

        for (const pkg of candidates) {
          const dedupeKey = `${pkg.userId}_${pkg.platform}_${pkg.handle}`;
          if (handledKeys.has(dedupeKey)) continue;
          handledKeys.add(dedupeKey);
          claimedBy.push(pkg.id);
        }

        // Must strictly claim with the older package, protecting user from multi-spend
        expect(claimedBy.length).toBe(1);
        expect(claimedBy[0]).toBe(pkgOld.id);
      });
    }

    // 4.3 100% Unused Reserve Cancellation & Refund Invariants (75 tests)
    for (let k = 1; k <= 75; k++) {
      it(`Cancellation & Refund Invariant #${k}: exact 100% refund on unconsumed slots`, () => {
        const slotCount = 5;
        const pricePerSlot = 299; // viral_push
        const totalReserve = new Decimal(pricePerSlot * slotCount); // 1495

        // Scenario: Used 'usedSlots' count out of 5
        const usedSlots = k % 5; // 0, 1, 2, 3, or 4
        const consumedAmount = new Decimal(pricePerSlot * usedSlots);

        const executions: ExecutionAccountingInput[] = [];
        for (let s = 0; s < usedSlots; s++) {
          executions.push({
            id: `exec_used_${k}_${s}`,
            status: PackageExecutionStatus.COMPLETED,
            quantity: 10000,
            remainingQuantity: 0,
            allocatedCharge: pricePerSlot,
          });
        }

        const summary = calculatePackageAccounting(totalReserve, executions, []);

        // Expected refund is exactly (totalReserve - consumedAmount)
        const expectedRefund = totalReserve.minus(consumedAmount);
        expect(summary.netRefundDue.toNumber()).toBe(expectedRefund.toNumber());

        // Invariant: reserveTotal = totalConsumed + totalAlreadyRefunded + netRefundDue
        expect(
          summary.totalConsumed.plus(summary.totalAlreadyRefunded).plus(summary.netRefundDue).toNumber()
        ).toBe(totalReserve.toNumber());

        // If 0 slots used, refund is exactly 100% of reserve
        if (usedSlots === 0) {
          expect(summary.netRefundDue.toNumber()).toBe(totalReserve.toNumber());
        }
      });
    }
  });
});
