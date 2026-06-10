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
  'Fast, accurate, and secure conversion of bank and credit card statements. Get clean data you trust in seconds.'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pdftoexcelstatementconverter.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Bank Statement Converter to Excel and CSV | StatementStudio',
    template: '%s | StatementStudio',
  },
  description,
  applicationName: 'StatementStudio',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bank Statement Converter to Excel and CSV | StatementStudio',
    description,
    url: siteUrl,
    siteName: 'StatementStudio',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bank Statement Converter to Excel and CSV | StatementStudio',
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
