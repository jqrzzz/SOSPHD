import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

export const metadata: Metadata = {
  // A template so every page that sets a plain title gets the suffix for
  // free, and pages that set none still get a sensible default tab name.
  title: {
    default: 'SOS PHD | Research Automation for Tourist SOS',
    template: '%s · SOS PHD',
  },
  description:
    'PhD research automation — track phases, generate papers, and measure TTDC/TTGP/TTTA from Tourist SOS operational data.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SOS PHD',
  },
  // app/icon.svg supplies the tab favicon by file convention. appleWebApp is
  // capable:true above, so iOS needs a real touch icon rather than falling back
  // to a screenshot of the page.
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
