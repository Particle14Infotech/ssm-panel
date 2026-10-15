export const BRAND_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "SMM Panel";

export function pageTitle(title?: string): string {
  if (!title) return BRAND_NAME;
  return `${title} | ${BRAND_NAME}`;
}
