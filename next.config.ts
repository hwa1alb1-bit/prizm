import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Content-Security-Policy lives in middleware.ts so each response carries a
// fresh nonce. Static headers below stay here.

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/app/settings',
        destination: '/app/account',
        permanent: true,
      },
      {
        source: '/app/billing',
        destination: '/app/account',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  telemetry: false,
})
