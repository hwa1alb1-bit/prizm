import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Montserrat } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  display: 'swap',
})

const description =
  'Convert bank, credit card, and financial statements into clean transaction files for QuickBooks, Xero, CSV, and Excel. No manual data entry.'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pdftoexcelstatementconverter.com'

const homeTitle = 'PDF Bank Statement Converter | StatementStudio'

// Default OG image. Square brand mark is a temporary fallback that satisfies the
// og:image / twitter:image presence requirement; replace with a 1200x630 banner
// at /marketing/og/default.png when design lands. See PR-D plan.
const defaultOgImage = {
  url: '/marketing/logos/statementstudio-mark.png',
  width: 512,
  height: 512,
  alt: 'StatementStudio',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: homeTitle,
    template: '%s | StatementStudio',
  },
  description,
  applicationName: 'StatementStudio',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: homeTitle,
    description,
    url: siteUrl,
    siteName: 'StatementStudio',
    type: 'website',
    locale: 'en_US',
    images: [defaultOgImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: homeTitle,
    description,
    images: [defaultOgImage.url],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  verification: {
    google: '6tfBgCcthX5dEemkyM1tbtNRMGmuLYNIsgAJPAGmAuQ',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading the nonce here ensures Next.js propagates it to framework scripts.
  // The middleware sets x-nonce on the request; the CSP header carries the
  // matching nonce-{value} + strict-dynamic so hydration scripts pass.
  await headers()
  return (
    <html lang="en" className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
