/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    // SECURITY: NEXTAUTH_SECRET must be set via environment variable only
    // It should NEVER be exposed to the client or have a default value
    // The secret is automatically handled by NextAuth on the server side
  },
}

module.exports = nextConfig