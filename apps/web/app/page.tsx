import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-900">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">ChainMail Global</span>
          <span className="text-gray-700">/</span>
          <span className="text-sm font-bold text-white">CMRAi</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="https://github.com/ChainMailGlobal/CMRAi" target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">GitHub</a>
          <a href="https://chainmail.global" target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">ChainMail</a>
          <Link href="/verify" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            Register →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 max-w-3xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-blue-950 border border-blue-800 rounded-full px-4 py-1.5 text-xs text-blue-300 font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          Live on Telegram · Discord · WhatsApp · Scroll L2
        </div>
        <h1 className="text-5xl font-bold tracking-tight leading-tight mb-6">
          Every AI agent needs a<br />
          <span className="text-blue-400">verified human</span> behind it.
        </h1>
        <p className="text-gray-400 text-xl leading-relaxed mb-4">
          49,400+ agents registered on ERC-8004. Zero verified human binding.
        </p>
        <p className="text-gray-500 text-lg mb-10">
          CMRAi fixes that. Start from Telegram, Discord, WhatsApp, or any supported channel — one constitutional verification ties every agent you deploy back to you, permanently on-chain.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Link href="/verify" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-colors">
            Register Your Identity →
          </Link>
          <a href="https://github.com/ChainMailGlobal/CMRAi" target="_blank" rel="noreferrer" className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-semibold text-lg px-8 py-4 rounded-2xl transition-colors">
            View on GitHub
          </a>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="border-t border-gray-900 px-6 py-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
          <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6">
            <div className="text-xs font-semibold tracking-widest text-red-400 uppercase mb-4">The Problem</div>
            <h3 className="text-xl font-bold mb-3">Agents act. Nobody is accountable.</h3>
            <p className="text-gray-400 text-sm leading-relaxed">AI agents send emails, execute trades, sign documents, and make decisions — with no verified link to the human responsible. When something goes wrong, there is no trail.</p>
          </div>
          <div className="bg-green-950/30 border border-green-900/50 rounded-2xl p-6">
            <div className="text-xs font-semibold tracking-widest text-green-400 uppercase mb-4">The Solution</div>
            <h3 className="text-xl font-bold mb-3">Every agent traces back to a person.</h3>
            <p className="text-gray-400 text-sm leading-relaxed">CMRAi issues a Human Origin Confirmation (HOC) — a cryptographic proof verified by MMCP that binds your identity to every agent you register. Start from your channel of choice. Anchored on Scroll L2. Permanent.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-900 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase text-center mb-10">How it works</div>
          <div className="flex flex-col gap-4">
            {[
              { step: '01', title: 'Verify your identity', desc: 'Live video, government ID, and constitutional oath — verified by MMCP, the ChainMail constitutional oracle. Takes 3 minutes.' },
              { step: '02', title: 'Receive your HOC', desc: 'Your Human Origin Confirmation is anchored on Scroll L2. Your CMID is minted on XRPL. Delivered to your channel of choice.' },
              { step: '03', title: 'Register your agents', desc: 'Every AI agent you deploy is bound to your HOC. If an agent acts, it traces back to you. No exceptions.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-6 items-start bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="text-3xl font-bold text-gray-700 shrink-0 w-10">{step}</div>
                <div>
                  <h4 className="font-bold text-white mb-1">{title}</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-gray-900 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase text-center mb-10">Who it's for</div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '👤', title: 'Individuals', desc: 'Register yourself and your personal AI agents. One free registration. Own your identity in the agentic economy.' },
              { icon: '🏢', title: 'Enterprises', desc: 'Compliance-ready agent accountability. NIST AI RMF aligned. Every agent deployment is auditable.' },
              { icon: '🛠️', title: 'Developers', desc: 'Open protocol. Build on CMRAi. Check HOC compliance before trusting another agent. Integrate via API.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-3">
                <span className="text-3xl">{icon}</span>
                <h4 className="font-bold text-white">{title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t border-gray-900 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase text-center mb-8">Built on</div>
          <div className="flex flex-wrap justify-center gap-3">
            {['MMCP Oracle', 'Scroll L2', 'XRPL', 'ElevenLabs', 'Pinata IPFS', 'NIST AI RMF', 'Telegram · Discord · WhatsApp'].map((tech) => (
              <span key={tech} className="bg-gray-900 border border-gray-800 text-gray-400 text-xs font-medium px-4 py-2 rounded-full">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-900 px-6 py-20">
        <div className="max-w-xl mx-auto text-center flex flex-col gap-6">
          <h2 className="text-3xl font-bold">Your first registration is free.</h2>
          <p className="text-gray-400">Verify your identity, anchor your HOC, and enter the agentic economy with your name on it.</p>
          <Link href="/verify" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg px-8 py-5 rounded-2xl transition-colors">
            Begin Verification →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-600">© 2026 ChainMail Global. Constitutional Identity Registry.</div>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <a href="https://github.com/ChainMailGlobal/CMRAi" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">GitHub</a>
            <a href="https://chainmail.global" target="_blank" rel="noreferrer" className="hover:text-gray-400 transition-colors">chainmail.global</a>
            <span>NIST AI RMF Compliant</span>
          </div>
        </div>
      </footer>

    </main>
  )
}
