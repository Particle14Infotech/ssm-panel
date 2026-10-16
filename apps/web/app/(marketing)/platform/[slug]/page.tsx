import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { PlatformIcon } from "@/components/shared/PlatformIcon";
import { ArrowRight, CheckCircle2, Shield, Zap, HelpCircle } from "lucide-react";

interface PlatformData {
  slug: string;
  name: string;
  metaTitle: string;
  metaDesc: string;
  headline: string;
  subheadline: string;
  overview: string;
  minPrice: string;
  orderNotes: string[];
  features: { title: string; desc: string }[];
  faqs: { q: string; a: string }[];
}

const PLATFORMS: Record<string, PlatformData> = {
  instagram: {
    slug: "instagram",
    name: "Instagram",
    metaTitle: "Instagram SMM Panel | Followers, Likes & Views in INR",
    metaDesc: "Order verified Instagram followers, likes, and reel views. Instant API dispatch, live order tracking, and balance protection in INR.",
    headline: "Instagram Growth Infrastructure",
    subheadline: "Direct API dispatch for Instagram followers, likes, comments, and reel views with live status synchronization.",
    overview:
      "Our Instagram delivery rails interface directly with tier-1 provider APIs to process follower, like, and video view requests. All orders require a public Instagram profile handle or direct post URL. Balances are held securely in INR paise, with automatic refunds credited to your ledger if a service encounters rate limits or partial completion.",
    minPrice: "₹24.50",
    orderNotes: [
      "Set your account privacy to Public before placing the order.",
      "Do not change your Instagram username or make your profile private while an order is active.",
      "Input post links in the format: https://www.instagram.com/p/POST_ID/ or reels at /reel/REEL_ID/.",
      "Average start time ranges between 5 to 60 minutes depending on server queue depth."
    ],
    features: [
      {
        title: "Automated Dispatch",
        desc: "Orders enter BullMQ job queues instantly upon payment confirmation, routing to active providers with zero manual delays."
      },
      {
        title: "Refill & Non-Drop Options",
        desc: "Select non-drop and 30-day refill guaranteed services from the catalog for resilient, sustainable follower retention."
      },
      {
        title: "Live Status Sync",
        desc: "Monitor start count, delivered count, and completion state in real-time through the customer dashboard."
      }
    ],
    faqs: [
      {
        q: "Do I need to share my Instagram password?",
        a: "No. We never ask for your account password. All services only require your public profile URL or public post link."
      },
      {
        q: "What happens if an order only partially delivers?",
        a: "Our double-entry accounting ledger automatically calculates remaining undelivered units and credits the refund back to your wallet."
      },
      {
        q: "Can I place multiple orders for the same post simultaneously?",
        a: "Wait until the current order updates to Completed or Partial before ordering the same service for that specific link to avoid counter desynchronization."
      }
    ]
  },
  youtube: {
    slug: "youtube",
    name: "YouTube",
    metaTitle: "YouTube SMM Panel | Watch Time, Views & Subscribers",
    metaDesc: "High-retention YouTube views, subscribers, and watch hours in INR. Automated API processing and real-time ledger tracking.",
    headline: "YouTube Audience & Watch Time Rail",
    subheadline: "Gradual-delivery views, channel subscribers, and monetizable watch hours engineered for organic retention.",
    overview:
      "YouTube algorithms reward high engagement durations and natural pacing. Our YouTube catalog emphasizes high-retention video views, non-drop channel subscribers, and community post engagements. Orders are dispatched through gradual distribution systems to align with YouTube studio analytics processing cycles.",
    minPrice: "₹85.00",
    orderNotes: [
      "Ensure your video is set to Public and not Unlisted or Private.",
      "Do not apply age restrictions or embed restrictions to the video link.",
      "Ensure channel subscriber count is publicly visible to allow automated start-count detection.",
      "For watch-time campaigns, videos must be at least 15 to 60 minutes long as specified in the service description."
    ],
    features: [
      {
        title: "High Retention Pacing",
        desc: "Views are distributed with realistic watch durations to prevent synthetic velocity spikes in YouTube Studio."
      },
      {
        title: "Double-Entry Balance Guarantee",
        desc: "Your funds are protected. Any service interruption immediately credits unserved fractions to your wallet."
      },
      {
        title: "Real-Time Counter Sync",
        desc: "Start counts are recorded from the public YouTube Data API and audited against delivery reports."
      }
    ],
    faqs: [
      {
        q: "How long does YouTube take to reflect new subscribers?",
        a: "YouTube Studio updates subscriber counts in rolling batches. Counters typically synchronize within 6 to 24 hours."
      },
      {
        q: "Are the views safe for monetized channels?",
        a: "We offer dedicated non-drop, organic-pattern high retention services that comply with safe view distribution guidelines."
      },
      {
        q: "What link format is required for YouTube orders?",
        a: "Use standard video URLs: https://www.youtube.com/watch?v=VIDEO_ID or channel URLs: https://www.youtube.com/@channel_handle."
      }
    ]
  },
  telegram: {
    slug: "telegram",
    name: "Telegram",
    metaTitle: "Telegram SMM Panel | Members & Post Views in INR",
    metaDesc: "Add verified Telegram channel members, group participants, and post views. Instant execution with double-entry balance protection.",
    headline: "Telegram Channel & Group Dispatch",
    subheadline: "Fast member delivery and post view distribution for public and private Telegram broadcast channels.",
    overview:
      "Scale broadcast reach across Telegram channels and discussion groups. We offer instant post views, persistent channel subscribers, and multi-post auto-views. Orders connect directly to high-throughput MTProto gateways, delivering members within minutes of queue admission.",
    minPrice: "₹18.00",
    orderNotes: [
      "Channel must have a public @username handle or valid permanent invitation link.",
      "Ensure channel administrative settings permit new participants without manual join request approvals.",
      "For post views, provide the direct message link (e.g., https://t.me/channel/1234).",
      "Do not revoke or alter the invitation link while a member delivery job is actively processing."
    ],
    features: [
      {
        title: "Sub-Second Admission",
        desc: "Orders are parsed and queued through BullMQ workers with instant provider assignment."
      },
      {
        title: "Country-Targeted Audiences",
        desc: "Select global or geo-targeted Telegram participants from India, USA, Central Europe, or CIS regions."
      },
      {
        title: "Zero Hidden Deductions",
        desc: "Clear per-1,000 unit pricing shown in INR paise with zero payment gateway processing surcharges."
      }
    ],
    faqs: [
      {
        q: "Can I order members for a private Telegram channel?",
        a: "Yes, provided you submit an active permanent invite link (t.me/+hash) that does not require admin approval."
      },
      {
        q: "How fast do Telegram post views start?",
        a: "Post views usually begin within 60 to 180 seconds and distribute across recent messages seamlessly."
      },
      {
        q: "What is the refund protocol if an invite link expires?",
        a: "The worker detects the connection error, cancels the batch, and refunds unspent paise directly to your wallet."
      }
    ]
  },
  tiktok: {
    slug: "tiktok",
    name: "TikTok",
    metaTitle: "TikTok SMM Panel | Followers, Likes & Video Views",
    metaDesc: "Scale TikTok videos with verified views, followers, and shares. High-speed provider sync, honest delivery times, and INR billing.",
    headline: "TikTok High-Frequency Growth",
    subheadline: "Real-time dispatch for TikTok video views, profile followers, comments, and shares across global audiences.",
    overview:
      "TikTok's recommendation engine relies on high early engagement velocity. Our TikTok delivery pipeline provides rapid view initialization and profile follower expansion. Every order is tracked from submission to completion through idempotent API jobs.",
    minPrice: "₹12.00",
    orderNotes: [
      "Your TikTok account must be set to Public with no regional download restrictions.",
      "Provide public video links formatted as: https://www.tiktok.com/@user/video/123456789.",
      "Do not delete or make the video private while an active order is in progress.",
      "Allow 10 to 45 minutes for initial queue ingestion before checking analytics."
    ],
    features: [
      {
        title: "Instant Video Dispatch",
        desc: "Views and likes begin arriving rapidly to signal initial engagement to TikTok's recommendation graph."
      },
      {
        title: "Idempotent Wallet Safety",
        desc: "Double-entry accounting ensures each transaction has a unique cryptographic reference key."
      },
      {
        title: "API-Ready Reselling",
        desc: "Integrate your own platform via our documented REST API with standard JSON payloads."
      }
    ],
    faqs: [
      {
        q: "Do you need my TikTok login credentials?",
        a: "Never. Only public video URLs or account usernames are needed."
      },
      {
        q: "Can I track order delivery in real time?",
        a: "Yes, every order status updates automatically from In Progress to Completed in your customer dashboard."
      },
      {
        q: "How are currency conversions handled?",
        a: "All balances, order costs, and refunds are calculated in Indian Rupees (INR) with integer paise precision."
      }
    ]
  }
};

export function generateStaticParams() {
  return Object.keys(PLATFORMS).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = PLATFORMS[params.slug];
  if (!p) return {};

  return {
    title: p.metaTitle,
    description: p.metaDesc,
    alternates: {
      canonical: `https://smmarchitecture.com/platform/${p.slug}`,
    },
    openGraph: {
      title: `${p.metaTitle} | SMM PANEL`,
      description: p.metaDesc,
      url: `https://smmarchitecture.com/platform/${p.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: p.metaTitle,
      description: p.metaDesc,
    },
  };
}

export default function PlatformPage({ params }: { params: { slug: string } }) {
  const p = PLATFORMS[params.slug];
  if (!p) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${p.name} SMM Growth Services`,
    provider: {
      "@type": "Organization",
      name: "SMM Panel",
      url: "https://smmarchitecture.com",
    },
    serviceType: "Social Media Marketing",
    description: p.metaDesc,
    offers: {
      "@type": "Offer",
      price: p.minPrice.replace("₹", ""),
      priceCurrency: "INR",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="w-full pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Breadcrumb
          items={[
            { label: "Services", href: "/services" },
            { label: p.name, href: `/platform/${p.slug}` },
          ]}
        />

        {/* Hero Banner */}
        <div className="mb-14 rounded-3xl p-8 md:p-12 bg-[#070B16]/80 border border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <PlatformIcon platform={p.slug} size={20} />
            </div>
            <span className="text-xs uppercase tracking-widest font-mono text-blue-400 font-semibold">
              {p.name} Service Catalog • From {p.minPrice} / 1K
            </span>
          </div>

          <h1 className="font-heading text-3xl sm:text-5xl font-light text-white tracking-tight mb-4 max-w-3xl">
            {p.headline}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-light max-w-2xl leading-relaxed mb-8">
            {p.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/services"
              className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-white/5 hover:bg-white/10 text-white font-medium text-sm border border-white/10 transition-all text-center"
            >
              Browse Full Catalog
            </Link>
          </div>
        </div>

        {/* Detailed Operational Overview (> 300 words total content requirement) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-14">
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl p-6 sm:p-8 bg-[#070B16]/60 border border-white/10 backdrop-blur-md">
              <h2 className="font-heading text-xl font-medium text-white mb-3">
                How Delivery & Automation Works
              </h2>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-4">
                {p.overview}
              </p>
              <p className="text-sm text-slate-300 font-light leading-relaxed">
                Orders are validated for correct syntax and immediately synchronized with high-availability API providers. All monetary movements adhere to our double-entry ledger invariant: your balance never decrements without a corresponding recorded transaction, ensuring zero leakage and automated refunds on order cancellations.
              </p>
            </div>

            <div className="rounded-2xl p-6 sm:p-8 bg-[#070B16]/60 border border-white/10 backdrop-blur-md">
              <h2 className="font-heading text-xl font-medium text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span>Account & Order Guidelines</span>
              </h2>
              <ul className="space-y-3">
                {p.orderNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 font-light">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            {p.features.map((feat, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-6 bg-[#070B16]/60 border border-white/10 backdrop-blur-md"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center mb-3">
                  <Zap className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-heading text-base font-medium text-white mb-1.5">
                  {feat.title}
                </h3>
                <p className="text-xs text-slate-400 font-light leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Platform-Specific FAQ */}
        <div className="rounded-3xl p-8 sm:p-10 bg-[#070B16]/80 border border-white/10 backdrop-blur-xl mb-14">
          <div className="flex items-center gap-2 mb-6 text-xs uppercase tracking-widest font-mono text-blue-400">
            <HelpCircle className="w-4 h-4" />
            <span>Frequently Asked Questions • {p.name}</span>
          </div>

          <div className="space-y-6">
            {p.faqs.map((faq, i) => (
              <div key={i} className="border-b border-white/10 pb-6 last:border-none last:pb-0">
                <h3 className="text-base font-medium text-white mb-2">
                  {faq.q}
                </h3>
                <p className="text-sm text-slate-300 font-light leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Final Platform CTA */}
        <div className="text-center py-10">
          <h2 className="font-heading text-2xl sm:text-3xl font-light text-white mb-3">
            Ready to order {p.name} services?
          </h2>
          <p className="text-sm text-slate-400 font-light mb-6 max-w-md mx-auto">
            Fund your wallet instantly using UPI, Cards, or Netbanking and dispatch your first order in under 60 seconds.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30"
          >
            <span>Get Started with SMM Panel</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
