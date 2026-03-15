import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bar Display | Le Vantage',
  description: 'Bar order display for Le Vantage Cafe',
  manifest: '/manifest-bar.json',
  icons: {
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bar Display',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function BarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
