import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "@/styles/globals.css";
import { landingContent } from "@/content/landing";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://smmpanel.com";
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "support@smmpanel.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${landingContent.brand.name} | Social Media Growth Services`,
    template: `%s | ${landingContent.brand.name}`,
  },
  description:
    "Order social growth services with real-time tracking, transparent INR pricing, and automatic wallet refunds.",
  keywords: [
    "SMM Panel",
    "Social Media Marketing",
    "Instagram Services",
    "TikTok Growth",
    "YouTube Subscribers",
    "Social Platform Growth",
    "Automated Order Dispatch",
  ],
  authors: [{ name: `${landingContent.brand.name} Platform` }],
  creator: landingContent.brand.name,
  publisher: landingContent.brand.name,
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: `${landingContent.brand.name} | Social Media Growth Platform`,
    description: "One unified wallet in INR, real-time order tracking, and automatic wallet refunds.",
    url: siteUrl,
    siteName: landingContent.brand.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${landingContent.brand.name} | Social Media Growth Platform`,
    description: "One unified wallet in INR, real-time order tracking, and automatic wallet refunds.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: landingContent.brand.name,
        url: siteUrl,
        logo: `${siteUrl}/icon.png`,
        description: "Social Media Marketing Platform with Real-time Order Tracking",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Customer Support",
          email: supportEmail,
          availableLanguage: ["English", "Hindi"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: landingContent.brand.name,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/services?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/#localbusiness`,
        name: landingContent.brand.name,
        url: siteUrl,
        logo: `${siteUrl}/icon.png`,
        image: `${siteUrl}/opengraph-image`,
        description: "Social Media Marketing Platform with Real-time Order Tracking",
        email: supportEmail,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          "streetAddress": "Tech Hub Corridor, Cyber City",
          "addressLocality": "Bengaluru",
          "addressRegion": "KA",
          "postalCode": "560001",
          "addressCountry": "IN",
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
            opens: "00:00",
            closes: "23:59",
          },
        ],
      },
    ],
  };

  return (
    <html lang="en-IN" className={`dark ${poppins.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#131313] text-[#e5e2e1] font-sans antialiased min-h-screen selection:bg-[#d8ec8d] selection:text-[#171e00]">
        {/* WCAG 2.2 AA Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#d8ec8d] text-[#171e00] font-bold rounded-full shadow-lg border border-[#d8ec8d]/40"
        >
          Skip to main content
        </a>

        <main id="main-content" className="w-full min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
