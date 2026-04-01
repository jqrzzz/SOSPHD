import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

export const metadata: Metadata = {
  title: 'SOS PHD | Research Automation for Tourist SOS',
  description:
    'PhD research automation — track phases, generate papers, and measure TTDC/TTGP/TTTA from Tourist SOS operational data.',
}

export const viewport: Viewport = {
  themeColor: '#0D1017',
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
