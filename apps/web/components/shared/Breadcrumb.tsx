import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const allItems = [{ label: "Home", href: "/" }, ...items];

  // Schema.org BreadcrumbList microdata
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: allItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `https://smmarchitecture.com${item.href}` : undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-zinc-400 mb-4 ${className}`}
      >
        <ol className="flex items-center space-x-2">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            return (
              <li key={index} className="flex items-center space-x-2">
                {index > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                )}
                {isLast || !item.href ? (
                  <span className="text-blue-400 font-medium" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    {index === 0 && <Home className="w-3 h-3 mb-0.5" />}
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
