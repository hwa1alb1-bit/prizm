import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Montserrat } from 'next/font/google'
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
  'Convert PDF bank statements into clean Excel or CSV files with secure processing, clear exports, and reconciliation-ready review.'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pdftoexcelstatementconverter.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Bank Statement Converter to Excel | PrizmView',
    template: '%s | PrizmView',
  },
  description,
  applicationName: 'PrizmView',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bank Statement Converter to Excel | PrizmView',
    description,
    url: siteUrl,
    siteName: 'PrizmView',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bank Statement Converter to Excel | PrizmView',
    description,
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
