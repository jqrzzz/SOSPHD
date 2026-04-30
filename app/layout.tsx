import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

export const metadata: Metadata = {
  title: 'SOS PHD | Research Automation for Tourist SOS',
  description:
    'PhD research automation — track phases, generate papers, and measure TTDC/TTGP/TTTA from Tourist SOS operational data.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SOS PHD',
  },
  icons: [
    { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}

export const viewport: Viewport = {
  themeColor: '#0A1018',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="font-sans antialiased"
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
