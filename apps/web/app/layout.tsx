import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "@/styles/globals.css";
import { landingContent } from "@/content/landing";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-urbanist",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://smmarchitecture.com"),
  title: {
    default: `${landingContent.brand.name} | Social Media Marketing Platform & Reseller Infrastructure`,
    template: `%s | ${landingContent.brand.name}`,
  },
  description:
    "Order verified social growth services with real-time tracking, double-entry protected ledger accounting, and sub-second automated provider synchronization.",
  keywords: [
    "SMM Panel",
    "Social Media Marketing",
    "Instagram Services",
    "TikTok Growth",
    "YouTube Subscribers",
    "Reseller API",
    "Social Platform Infrastructure",
    "Automated Order Dispatch",
  ],
  authors: [{ name: `${landingContent.brand.name} Platform` }],
  creator: landingContent.brand.name,
  publisher: landingContent.brand.name,
  alternates: {
    canonical: "https://smmarchitecture.com",
  },
  openGraph: {
    title: `${landingContent.brand.name} | Social Media Marketing Platform`,
    description: "One unified wallet, 500+ direct provider services, real-time sync, and double-entry protected ledger accounting.",
    url: "https://smmarchitecture.com",
    siteName: landingContent.brand.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${landingContent.brand.name} | Social Media Marketing Platform`,
    description: "One unified wallet, 500+ direct provider services, real-time sync, and double-entry protected ledger accounting.",
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
        "@id": "https://smmarchitecture.com/#organization",
        name: landingContent.brand.name,
        url: "https://smmarchitecture.com",
        logo: "https://smmarchitecture.com/icon.png",
        description: "Authoritative Social Media Marketing Platform and Reseller API Infrastructure",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Customer Support",
          email: "support@aethersmm.internal",
          availableLanguage: ["English", "Hindi"],
        },
      },
      {
        "@type": "WebSite",
        "@id": "https://smmarchitecture.com/#website",
        url: "https://smmarchitecture.com",
        name: landingContent.brand.name,
        publisher: {
          "@id": "https://smmarchitecture.com/#organization",
        },
        potentialAction: {
          "@type": "SearchAction",
          target: "https://smmarchitecture.com/services?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "LocalBusiness",
        "@id": "https://smmarchitecture.com/#localbusiness",
        name: landingContent.brand.name,
        url: "https://smmarchitecture.com",
        logo: "https://smmarchitecture.com/icon.png",
        image: "https://smmarchitecture.com/opengraph-image",
        description: "Authoritative Social Media Marketing Platform and Reseller API Infrastructure",
        email: "support@aethersmm.internal",
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
    <html lang="en" className={`dark ${urbanist.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional"
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
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#d8ec8d] text-[#171e00] font-bold rounded-full shadow-lg"
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
