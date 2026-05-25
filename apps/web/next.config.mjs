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
  // The workspace packages use NodeNext-style `.js` import suffixes on TS
  // sources (`export * from './module/workspaces.js'`). tsc + vitest strip
  // the `.js` via tsconfig's `moduleResolution: "bundler"`, but webpack
  // needs `extensionAlias` to do the same — without it every API route
  // that imports from @weekly-food-planner/supabase fails at request time
  // with "Module not found: Can't resolve './module/...js'".
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default nextConfig
