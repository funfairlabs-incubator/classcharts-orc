/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@google-cloud/storage', '@google-cloud/firestore', 'classcharts-api'],
  },
};

module.exports = nextConfig;
