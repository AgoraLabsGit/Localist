import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Reduces webpack cache "Serializing big strings" warning (icon/barrel packages)
    optimizePackageImports: ["lucide-react"],
  },
};

export default withNextIntl(nextConfig);
