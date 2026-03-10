/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@google-cloud/storage', '@google-cloud/firestore'],
  },
};

module.exports = nextConfig;
