/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Reduces webpack cache "Serializing big strings" warning (icon/barrel packages)
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
