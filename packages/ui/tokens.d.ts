export interface ThemeTokenSet {
  bg: string;
  surface: string;
  "surface-glass": string;
  "surface-raised": string;
  fg: string;
  "fg-2": string;
  "fg-muted": string;
  border: string;
  "border-control": string;
  accent: string;
  "on-accent": string;
  "accent-text": string;
  success: string;
  "success-bg": string;
  warning: string;
  "warning-bg": string;
  danger: string;
  "danger-bg": string;
  info: string;
  "info-bg": string;
  focus: string;
  glow: string;
  overlay: string;
  "shadow-card": string;
  "shadow-glass": string;
}

export interface RadiiTokens {
  card: string;
  sheet: string;
  control: string;
  chip: string;
}

export interface DesignTokens {
  dark: ThemeTokenSet;
  light: ThemeTokenSet;
  radii: RadiiTokens;
}

export declare const tokens: DesignTokens;
export declare function generateCssVariables(): string;

