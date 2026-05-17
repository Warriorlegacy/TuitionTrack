/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["date-fns", "lucide-react", "recharts"],
  },
};

export default nextConfig;
