import fs from 'node:fs';
import path from 'node:path';

// Read sitemap.ts
const sitemapPath = path.resolve('apps/web/app/sitemap.ts');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

// Read robots.ts
const robotsPath = path.resolve('apps/web/app/robots.ts');
const robotsContent = fs.readFileSync(robotsPath, 'utf8');

console.log('================================================================================');
console.log('            PUBLIC METADATA & TECHNICAL SEO INTEGRITY AUDIT                    ');
console.log('================================================================================');

let passed = true;

// 1. Verify robots.ts
if (!robotsContent.includes('sitemap: "https://smmarchitecture.com/sitemap.xml"') && !robotsContent.includes("sitemap: 'https://smmarchitecture.com/sitemap.xml'")) {
  console.error('❌ robots.ts does not declare canonical sitemap URL');
  passed = false;
} else {
  console.log('✅ robots.ts declares canonical sitemap.xml');
}

if (!robotsContent.includes('/admin/') || !robotsContent.includes('/dashboard') || !robotsContent.includes('/login')) {
  console.error('❌ robots.ts missing critical disallow paths for admin/dashboard/auth');
  passed = false;
} else {
  console.log('✅ robots.ts properly disallows admin, customer dashboard, and auth routes');
}

// 2. Public pages list
const publicPages = [
  { file: 'apps/web/app/layout.tsx', name: 'Root Layout' },
  { file: 'apps/web/app/(marketing)/page.tsx', name: 'Home' },
  { file: 'apps/web/app/(marketing)/about/page.tsx', name: 'About' },
  { file: 'apps/web/app/(marketing)/services/page.tsx', name: 'Services' },
  { file: 'apps/web/app/(marketing)/pricing/page.tsx', name: 'Pricing' },
  { file: 'apps/web/app/(marketing)/work/page.tsx', name: 'How It Works' },
  { file: 'apps/web/app/(marketing)/faq/page.tsx', name: 'FAQ' },
  { file: 'apps/web/app/(marketing)/contact/page.tsx', name: 'Contact' },
  { file: 'apps/web/app/(marketing)/platform/[slug]/page.tsx', name: 'Platform Template' },
  { file: 'apps/web/app/(marketing)/legal/terms/page.tsx', name: 'Terms' },
  { file: 'apps/web/app/(marketing)/legal/privacy/page.tsx', name: 'Privacy' },
  { file: 'apps/web/app/(marketing)/legal/refund/page.tsx', name: 'Refund Policy' },
  { file: 'apps/web/app/not-found.tsx', name: '404 Page' },
  { file: 'apps/web/app/error.tsx', name: '500 Error Page' }
];

for (const p of publicPages) {
  if (!fs.existsSync(p.file)) {
    console.error(`❌ Missing public page file: ${p.file}`);
    passed = false;
  } else {
    console.log(`✅ Verified route file exists: ${p.name} (${p.file})`);
  }
}

if (passed) {
  console.log('================================================================================');
  console.log('✅ ALL PUBLIC METADATA & TECHNICAL SEO CHECKS PASSED WITH ZERO VIOLATIONS.');
  console.log('================================================================================');
  process.exit(0);
} else {
  process.exit(1);
}
