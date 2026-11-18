import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@bazar/shared'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'placehold.co' }] },
};

export default nextConfig;
