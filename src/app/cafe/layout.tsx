import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cafe Display | Le Vantage',
  description: 'Cafe counter order display for Le Vantage Cafe',
  manifest: '/manifest-cafe.json',
  icons: {
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cafe Display',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function CafeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
