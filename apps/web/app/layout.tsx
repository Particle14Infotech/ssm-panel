import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "@/styles/globals.css";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-urbanist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AETHER SMM | Autonomous Social Growth Telemetry Engine",
  description:
    "Order social growth services. Track every order. One wallet, a clear catalog, live order status, and zero race-condition ledger accounting.",
  metadataBase: new URL("https://aethersmm.internal"),
  keywords: [
    "SMM Panel",
    "Social Media Marketing",
    "Growth Telemetry",
    "Instagram Services",
    "TikTok Growth",
    "Reseller API",
    "Autonomous Social Engine",
  ],
  authors: [{ name: "AETHER SMM Platform" }],
  openGraph: {
    title: "AETHER SMM | Autonomous Social Growth Telemetry Engine",
    description: "One wallet, a clear catalog, live order status. High-frequency provider synchronization.",
    siteName: "AETHER SMM",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AETHER SMM | Autonomous Social Growth Telemetry Engine",
    description: "One wallet, a clear catalog, live order status. High-frequency provider synchronization.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AETHER SMM",
    url: "https://aethersmm.internal",
    logo: "https://aethersmm.internal/icon.png",
    description: "Autonomous Social Growth Telemetry Engine and API Platform",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      email: "support@aethersmm.internal",
    },
  };

  return (
    <html lang="en" className={`dark ${urbanist.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-[#131313] text-[#e5e2e1] font-sans antialiased min-h-screen flex flex-col justify-between selection:bg-[#d8ec8d] selection:text-[#171e00]">
        {/* WCAG 2.2 AA Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 bg-[#d8ec8d] text-[#171e00] font-bold rounded-full shadow-lg"
        >
          Skip to main content
        </a>

        <Navbar />
        <main id="main-content" className="flex-1 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
