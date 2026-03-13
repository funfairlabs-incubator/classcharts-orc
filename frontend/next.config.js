/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trust NEXTAUTH_URL over x-forwarded-host (App Engine sets appspot.com internally)
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  experimental: {
    serverComponentsExternalPackages: ['@google-cloud/storage', '@google-cloud/firestore', 'classcharts-api'],
  },
};

module.exports = nextConfig;
