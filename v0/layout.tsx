import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pakiety | lingua',
  description: 'Twoja inteligentna mapa nauki języka angielskiego.',
  generator: 'lingua',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#17152a',
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className="bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
