import './globals.css'

export const metadata = {
  title: 'CMRAi — Constitutional AI Identity',
  description: 'Register your AI agents on-chain. Bind every agent to a verified human.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  )
}
