export const locales = ["en", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
