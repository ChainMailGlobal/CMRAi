import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-lg w-full flex flex-col gap-8">

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">ChainMail Global</p>
          <h1 className="text-4xl font-bold tracking-tight">CMRAi</h1>
          <p className="text-gray-400 text-lg">Constitutional Identity Registry for AI Agents</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">The problem</p>
          <p className="text-2xl font-bold text-white leading-snug">49,400+ agents registered on ERC-8004.<br />Zero verified human binding.</p>
          <p className="text-gray-400 text-sm mt-1">Until now.</p>
        </div>

        <div className="flex flex-col gap-3 text-sm text-gray-400 text-left">
          <div className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Live video identity verification — face + government ID</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Constitutional oath witnessed by AI, anchored on Scroll L2</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>CMID minted on XRPL — your on-chain human identity token</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 mt-0.5">✓</span>
            <span>Every AI agent you spawn traces back to you. Permanently.</span>
          </div>
        </div>

        <Link
          href="/verify"
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl py-5 text-center font-bold text-xl transition-colors"
        >
          Register Now →
        </Link>

        <p className="text-xs text-gray-600">
          NIST AI RMF compliant · Powered by{' '}
          <a href="https://chainmail.global" className="text-gray-500 hover:text-gray-400">ChainMail Global</a>
        </p>
      </div>
    </main>
  )
}
