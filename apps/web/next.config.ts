import type { NextConfig } from 'next';

const apiOrigin = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['*.monkeycode-ai.live'],
  experimental: {
    // Memory artifacts are up to 4 MiB of binary, base64-encoded in the browser
    // before they reach a server action, which inflates the body past the 1 MiB
    // default. The API still enforces the decoded size limit.
    serverActions: { bodySizeLimit: '6mb' },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
