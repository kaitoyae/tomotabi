import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'トモタビ',
  description: 'お出かけ・旅行プランを1分で作って友達と共有',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/images/logo_tomotabi.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        url: '/images/logo_tomotabi.png',
        sizes: '96x96',
        type: 'image/png',
      },
      {
        url: '/images/logo_tomotabi.png',
        sizes: '128x128',
        type: 'image/png',
      }
    ],
    shortcut: '/images/logo_tomotabi.png',
    apple: {
      url: '/images/logo_tomotabi.png',
      sizes: '180x180',
      type: 'image/png',
    },
  },
  openGraph: {
    title: 'トモタビ',
    description: 'お出かけ・旅行プランを1分で作って友達と共有',
    url: 'https://tomotabi.app',
    siteName: 'トモタビ',
    images: [
      {
        url: '/images/eyecatch.png',
        width: 1200,
        height: 675,
        alt: 'トモタビ - お出かけ・旅行プランを1分で作って友達と共有',
      }
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'トモタビ',
    description: 'お出かけ・旅行プランを1分で作って友達と共有',
    images: ['/images/eyecatch.png'],
    creator: '@tomotabi_app',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/images/logo_tomotabi.png" sizes="128x128" type="image/png" />
        <link rel="icon" href="/images/logo_tomotabi.png" sizes="96x96" type="image/png" />
        <link rel="shortcut icon" href="/images/logo_tomotabi.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}