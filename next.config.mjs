/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["date-fns", "lucide-react", "recharts"],
  },
  // NOTE: no `env: { SUPABASE_SERVICE_ROLE_KEY }` here on purpose. Next inlines
  // `env` values into the client bundle, so declaring the privileged key would
  // ship a RLS-bypassing credential to the browser (blueprint #49). Server code
  // reads it directly from process.env at runtime instead.
};

export default nextConfig;