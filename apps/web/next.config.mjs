/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace TS packages are consumed from source; transpile them in the
  // Next.js build pipeline.
  transpilePackages: [
    '@weekly-food-planner/constraint-engine',
    '@weekly-food-planner/supabase',
    '@weekly-food-planner/test-utils',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
