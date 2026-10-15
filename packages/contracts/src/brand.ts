export const DEFAULT_BRAND_NAME = "SMM Panel";

export function getBrandName(): string {
  if (typeof process !== "undefined" && process.env) {
    return process.env.NEXT_PUBLIC_SITE_NAME || process.env.SITE_NAME || DEFAULT_BRAND_NAME;
  }
  return DEFAULT_BRAND_NAME;
}

export const BRAND_NAME = getBrandName();
