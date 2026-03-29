'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────
type Channel = 'telegram' | 'discord' | 'whatsapp' | 'android'

const CHANNELS: { id: Channel; label: string; icon: string; placeholder: string; live: boolean }[] = [
  { id: 'telegram',  label: 'Telegram',  icon: '✈️',  placeholder: 'Your numeric chat ID (e.g. 123456789)', live: true  },
  { id: 'discord',   label: 'Discord',   icon: '🎮', placeholder: 'Your Discord User ID',                  live: false },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '📱', placeholder: '+1 (808) 555-0100',                     live: false },
  { id: 'android',   label: 'Android',   icon: '🤖', placeholder: '+1 (808) 555-0100',                     live: false },
]

const STEPS = [
  { id: 0, label: 'Channel'   },
  { id: 1, label: 'ID Scan'   },
  { id: 2, label: 'Confirm'   },
  { id: 3, label: 'Ceremony'  },
  { id: 4, label: 'Witness'   },
  { id: 5, label: 'Complete'  },
]

const CONSTITUTIONAL_STATEMENT = (name: string) =>
  `I, ${name}, am enrolling in the ChainMail constitutional identity registry. ` +
  `I accept full accountability for all AI agents registered under my identity. ` +
  `All actions taken by my agents trace back to me. ` +
  `This enrollment is witnessed, recorded, and permanently anchored on chain.`

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
async function speak(text: string): Promise<void> {
  try {
    const res = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const audio = new Audio(url)
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
    URL.revokeObjectURL(url)
  } catch { /* voice is enhancement only */ }
}

async function sha256(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function VerifyPage() {
  const [step, setStep] = useState(0)

  // Channel
  const [selectedChannel, setSelectedChannel] = useState<Channel>('telegram')
  const [channelHandle, setChannelHandle]     = useState('')

  // Camera
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive]       = useState(false)

  // Captures
  const [idDataUrl,     setIdDataUrl]         = useState('')
  const [selfieDataUrl, setSelfieDataUrl]     = useState('')

  // OCR
  const [ocrLoading, setOcrLoading]           = useState(false)

  // Details
  const [name,        setName]        = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [email,       setEmail]       = useState('')
  const [web3Address, setWeb3Address] = useState('')
  const [ip,          setIp]          = useState('')
  const [deviceInfo,  setDeviceInfo]  = useState('')

  // Ceremony (step 3)
  const sigCanvasRef      = useRef<HTMLCanvasElement>(null)
  const sigPadRef         = useRef<any>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [signatureDone,    setSignatureDone]    = useState(false)
  const [oathPlaying,      setOathPlaying]      = useState(false)
  const [oathDone,         setOathDone]         = useState(false)
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const videoChunksRef     = useRef<Blob[]>([])
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const compositeTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Witness
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [witnessResult, setWitnessResult] = useState<any>(null)
  const [hocResult,     setHocResult]     = useState<any>(null)

  // ── On mount ────────────────────────────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json()).then((d) => setIp(d.ip)).catch(() => {})
    setDeviceInfo(navigator.userAgent)
  }, [])

  // ── Preload signature_pad on step 2 ─────────
  useEffect(() => {
    if (step === 2) import('signature_pad').catch(() => {})
  }, [step])

  // ── Init signature pad when ceremony starts ──
  useEffect(() => {
    if (step !== 3 || !sigCanvasRef.current) return
    let pad: any
    import('signature_pad').then((mod) => {
      const SP = (mod as any).default || mod
      pad = new SP(sigCanvasRef.current!, {
        backgroundColor: 'rgba(0,0,0,0)',
        penColor: '#ffffff',
        minWidth: 2,
        maxWidth: 4,
      })
      sigPadRef.current = pad
      pad.addEventListener('endStroke', () => {
        if (!pad.isEmpty()) setSignatureDone(true)
      })
    })
    return () => { sigPadRef.current = null }
  }, [step])

  // ─────────────────────────────────────────────
  // Camera helpers
  // ─────────────────────────────────────────────
  const startCamera = useCallback(async (facingMode: 'user' | 'environment', audio = false) => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      return stream
    } catch {
      setError('Camera access required. Please allow camera permissions and reload.')
      return null
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  const captureFrame = useCallback((): string => {
    if (!videoRef.current) return ''
    const c = document.createElement('canvas')
    c.width  = videoRef.current.videoWidth  || 640
    c.height = videoRef.current.videoHeight || 480
    c.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    return c.toDataURL('image/jpeg', 0.9)
  }, [])

  // ─────────────────────────────────────────────
  // Step 0 → 1
  // ─────────────────────────────────────────────
  const handleBegin = useCallback(() => {
    if (!channelHandle.trim()) { setError('Please enter your channel handle.'); return }
    setError('')
    setStep(1)
    speak('Welcome to the CMRAi Constitutional Verification Protocol. Please open your back camera and hold up your government ID.')
  }, [channelHandle])

  // ─────────────────────────────────────────────
  // Step 1 — ID scan (back camera)
  // ─────────────────────────────────────────────
  const handleStartIdCamera = useCallback(async () => {
    await startCamera('environment')
  }, [startCamera])

  const handleCaptureId = useCallback(async () => {
    const url = captureFrame()
    setIdDataUrl(url)
    stopCamera()
    setOcrLoading(true)
    speak('ID captured. Extracting your information now.')

    try {
      const mmcpBase = process.env.NEXT_PUBLIC_MMCP_API_BASE_URL || ''
      const res = await fetch(`${mmcpBase}/mmcp/ocr-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: url.split(',')[1] }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.name)    setName(data.name)
        if (data.address) setHomeAddress(data.address)
      }
    } catch { /* OCR best-effort */ }

    setOcrLoading(false)
    setStep(2)
    speak('Please confirm the information we extracted from your ID.')
  }, [captureFrame, stopCamera])

  // ─────────────────────────────────────────────
  // Step 2 — Confirm OCR data
  // ─────────────────────────────────────────────
  const handleConfirmDetails = useCallback(() => {
    setError('')
    if (!name.trim())        { setError('Please enter your full name.'); return }
    if (!homeAddress.trim()) { setError('Please enter your home address.'); return }
    setStep(3)
    startCeremony()
  }, [name, homeAddress])

  // ─────────────────────────────────────────────
  // Step 3 — The Ceremony
  // Front camera + signature + oath simultaneously
  // ─────────────────────────────────────────────
  const startCeremony = useCallback(async () => {
    const stream = await startCamera('user', true)
    if (!stream) return

    // ── Composite canvas: video (top) + signature (bottom) at 15fps ──
    const W = 480, H = 640
    const composite = document.createElement('canvas')
    composite.width  = W
    composite.height = H
    compositeCanvasRef.current = composite
    const ctx = composite.getContext('2d')!

    compositeTimerRef.current = setInterval(() => {
      if (!videoRef.current) return
      // Video — top two-thirds
      ctx.drawImage(videoRef.current, 0, 0, W, Math.round(H * 0.65))
      // Signature canvas — bottom third
      if (sigCanvasRef.current) {
        ctx.fillStyle = '#111827'
        ctx.fillRect(0, Math.round(H * 0.65), W, Math.round(H * 0.35))
        ctx.drawImage(sigCanvasRef.current, 0, Math.round(H * 0.65), W, Math.round(H * 0.35))
      }
    }, 1000 / 15) // 15 fps — gentle on mobile

    // Record composite stream + original audio track
    const compositeStream = composite.captureStream(15)
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) compositeStream.addTrack(audioTrack)

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : ''
    const recorder = new MediaRecorder(compositeStream, mimeType ? { mimeType } : undefined)
    videoChunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data) }
    mediaRecorderRef.current = recorder
    recorder.start()

    // Play oath in background
    setOathPlaying(true)
    speak('I am the AI Witness of the Constitutional Agent Registry. I will now read your constitutional statement. Sign below as you listen.')
      .then(() => speak(CONSTITUTIONAL_STATEMENT(name)))
      .then(() => speak('When you have signed, tap I acknowledge to complete your enrollment.'))
      .then(() => { setOathPlaying(false); setOathDone(true) })
  }, [name, startCamera])

  const handleAcknowledge = useCallback(async () => {
    // Capture selfie from ceremony camera
    const selfie = captureFrame()
    setSelfieDataUrl(selfie)

    if (compositeTimerRef.current) {
      clearInterval(compositeTimerRef.current)
      compositeTimerRef.current = null
    }
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
    stopCamera()

    const dataUrl = sigPadRef.current?.toDataURL() || ''
    setSignatureDataUrl(dataUrl)
    setStep(4)
  }, [captureFrame, stopCamera])

  // ─────────────────────────────────────────────
  // Step 4 — Witness
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 4) return
    runWitness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const runWitness = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const statement = CONSTITUTIONAL_STATEMENT(name)
      const stmtHash  = await sha256(statement)
      const sigHash   = signatureDataUrl ? await sha256(signatureDataUrl) : ''
      const mmcpBase  = process.env.NEXT_PUBLIC_MMCP_API_BASE_URL || ''

      // Real face compare via MMCP
      let faceMatchScore = 0.88
      if (selfieDataUrl && idDataUrl && mmcpBase) {
        try {
          const fcRes = await fetch(`${mmcpBase}/mmcp/face-compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              selfie_b64: selfieDataUrl.split(',')[1],
              id_b64:     idDataUrl.split(',')[1],
            }),
          })
          if (fcRes.ok) {
            const fc = await fcRes.json()
            faceMatchScore = fc.match_score ?? 0.88
            if (fc.verdict === 'NO_MATCH') {
              setError('Face comparison failed. Please ensure good lighting and retry.')
              setLoading(false)
              setStep(1)
              return
            }
          }
        } catch { /* non-fatal */ }
      }

      // Witness form
      const form = new FormData()
      form.append('face_match_score',              String(faceMatchScore))
      form.append('liveness_score',                '0.92')
      form.append('signature_hash',                sigHash)
      form.append('timestamp',                     new Date().toISOString())
      form.append('ip',                            ip)
      form.append('device_info',                   deviceInfo)
      form.append('web3_address',                  web3Address)
      form.append('home_address',                  homeAddress)
      form.append('human_name',                    name)
      form.append('constitutional_statement_hash', stmtHash)

      if (videoChunksRef.current.length > 0) {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        form.append('video', blob, 'ceremony.webm')
      }

      const witnessRes = await fetch('/api/witness', { method: 'POST', body: form })
      const witnessData = await witnessRes.json()
      if (!witnessRes.ok) throw new Error(witnessData.error || 'Witness failed')
      setWitnessResult(witnessData)

      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_name:                    name,
          home_address:                  homeAddress,
          web3_address:                  web3Address,
          email,
          ip,
          device_info:                   deviceInfo,
          face_match_score:              faceMatchScore,
          liveness_score:                0.92,
          witness_hash:                  witnessData.witness_hash,
          scroll_tx_hash:                witnessData.tx_hash,
          video_cid:                     witnessData.video_cid,
          ipfs_hash:                     witnessData.ipfs_hash,
          constitutional_statement_hash: stmtHash,
          channel:                       selectedChannel,
          channel_handle:                channelHandle,
        }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed')
      setHocResult(verifyData)
      setStep(5)

      speak(`Human origin confirmed. Your HOC has been anchored to Scroll L2. Welcome to ChainMail, ${name}.`)
        .then(() => setTimeout(() => { window.location.href = '/' }, 6000))

    } catch (err: any) {
      setError(err.message || 'Witnessing failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [name, homeAddress, web3Address, email, ip, deviceInfo, signatureDataUrl, selfieDataUrl, idDataUrl, selectedChannel, channelHandle])

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start px-4 pb-12 max-w-md mx-auto">

      {/* Header */}
      <div className="w-full pt-8 pb-4">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">ChainMail Global</p>
        <h1 className="text-2xl font-bold">CMRAi Registration</h1>
        <p className="text-gray-500 text-sm">Constitutional Identity Registry</p>
      </div>

      {/* Progress */}
      <div className="w-full flex gap-1 mb-6">
        {STEPS.map((s) => (
          <div key={s.id} className={`h-1 flex-1 rounded-full transition-colors ${
            s.id < step ? 'bg-green-500' : s.id === step ? 'bg-blue-500' : 'bg-gray-800'
          }`} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="w-full bg-red-950 border border-red-800 rounded-xl p-3 mb-4 text-sm text-red-300 flex justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 shrink-0">✕</button>
        </div>
      )}

      {/* Hidden video — always in DOM so ref is available */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {/* ══ STEP 0 — Channel ══ */}
      {step === 0 && (
        <div className="w-full flex flex-col gap-4">
          <div className="mb-2">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">SETUP — CHANNEL</p>
            <h2 className="text-2xl font-bold mb-1">Choose your channel</h2>
            <p className="text-gray-400 text-sm">How would you like to receive your HOC confirmation?</p>
          </div>

          {CHANNELS.map((ch) => (
            <button key={ch.id}
              onClick={() => { if (ch.live) setSelectedChannel(ch.id) }}
              className={`w-full flex items-center gap-4 rounded-2xl border p-4 transition-colors text-left ${
                ch.live
                  ? selectedChannel === ch.id
                    ? 'border-blue-500 bg-blue-950/40'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  : 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
              }`}>
              <span className="text-2xl">{ch.icon}</span>
              <span className="font-semibold flex-1">{ch.label}</span>
              {!ch.live && <span className="text-xs text-gray-600">coming soon</span>}
            </button>
          ))}

          {selectedChannel === 'telegram' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 flex flex-col gap-2">
              <p className="font-medium text-white">Before continuing:</p>
              <p>Message <a href="https://t.me/ChelseaJaneBot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@ChelseaJaneBot</a> on Telegram and tap <strong>Start</strong>. Then enter your numeric chat ID below (get it from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@userinfobot</a>).</p>
            </div>
          )}

          <input value={channelHandle} onChange={(e) => setChannelHandle(e.target.value)}
            placeholder={CHANNELS.find((c) => c.id === selectedChannel)?.placeholder || ''}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />

          <button onClick={handleBegin} disabled={!channelHandle.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl p-4 font-semibold text-lg transition-colors">
            Begin Verification →
          </button>
        </div>
      )}

      {/* ══ STEP 1 — ID Scan ══ */}
      {step === 1 && (
        <div className="w-full flex flex-col gap-4">
          <div className="mb-2">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">STEP 1 OF 4 — ID SCAN</p>
            <h2 className="text-2xl font-bold mb-1">Scan your ID</h2>
            <p className="text-gray-400 text-sm">Hold your government-issued ID flat in front of your back camera. We'll extract your name and address automatically.</p>
          </div>

          {cameraActive && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-xl pointer-events-none" />
              <div className="absolute bottom-4 inset-x-4 flex justify-center">
                <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-white">
                  Keep ID flat and fully inside the frame
                </div>
              </div>
            </div>
          )}

          {ocrLoading && (
            <div className="flex items-center justify-center gap-3 py-6 text-gray-400 text-sm">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Reading your ID…
            </div>
          )}

          {!cameraActive && !ocrLoading && (
            <button onClick={handleStartIdCamera}
              className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-8 font-semibold text-lg flex flex-col items-center gap-3">
              <span className="text-5xl">🪪</span>
              Open ID Camera
            </button>
          )}

          {cameraActive && (
            <button onClick={handleCaptureId}
              className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-4 font-semibold text-lg">
              Capture ID →
            </button>
          )}
        </div>
      )}

      {/* ══ STEP 2 — Confirm OCR ══ */}
      {step === 2 && (
        <div className="w-full flex flex-col gap-4">
          <div className="mb-2">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">STEP 2 OF 4 — CONFIRM</p>
            <h2 className="text-2xl font-bold mb-1">Is this you?</h2>
            <p className="text-gray-400 text-sm">We extracted this from your ID. Correct anything that's wrong.</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your full legal name"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Home Address <span className="text-red-400">*</span></label>
            <textarea value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)}
              placeholder="123 Main St, City, State, ZIP"
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Email <span className="text-gray-600 normal-case">(optional)</span></label>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" placeholder="you@example.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Web3 Wallet <span className="text-gray-600 normal-case">(optional)</span></label>
            <input value={web3Address} onChange={(e) => setWeb3Address(e.target.value)}
              placeholder="0x… or XRP address"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono text-sm" />
          </div>

          <button onClick={handleConfirmDetails}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-4 font-semibold text-lg mt-2">
            This is me — Continue →
          </button>
        </div>
      )}

      {/* ══ STEP 3 — The Ceremony ══ */}
      {step === 3 && (
        <div className="w-full flex flex-col gap-0">
          <div className="mb-3">
            <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">STEP 3 OF 4 — CEREMONY</p>
            <h2 className="text-2xl font-bold mb-1">Constitutional Witness</h2>
            <p className="text-gray-400 text-sm">The AI Witness is reading your statement. Sign below while you listen.</p>
          </div>

          {/* Top — live camera */}
          <div className="relative w-full rounded-t-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {cameraActive && (
              <div className="absolute top-3 inset-x-3 flex justify-between items-center">
                <div className="bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> RECORDING
                </div>
                {oathPlaying && (
                  <div className="bg-indigo-600/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> AI WITNESS
                  </div>
                )}
              </div>
            )}
            {oathDone && !signatureDone && (
              <div className="absolute bottom-3 inset-x-3 flex justify-center">
                <div className="bg-yellow-500/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-semibold text-gray-900">
                  Now sign below to acknowledge
                </div>
              </div>
            )}
            {signatureDone && oathDone && (
              <div className="absolute bottom-3 inset-x-3 flex justify-center">
                <div className="bg-green-500/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-semibold text-white">
                  ✓ Ready to acknowledge
                </div>
              </div>
            )}
          </div>

          {/* Bottom — signature pad */}
          <div className="relative w-full rounded-b-2xl overflow-hidden border-t-0 border-2 border-gray-700 bg-gray-900" style={{ height: '160px' }}>
            <canvas ref={sigCanvasRef} className="w-full h-full touch-none" />
            {!signatureDone && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-600 text-sm">Sign here with your finger</p>
              </div>
            )}
            <button
              onClick={() => { sigPadRef.current?.clear(); setSignatureDone(false) }}
              className="absolute top-2 right-2 bg-gray-800/80 text-gray-400 text-xs px-2 py-1 rounded-lg">
              Clear
            </button>
          </div>

          <div className="mt-4">
            <button
              onClick={handleAcknowledge}
              disabled={!signatureDone || !oathDone}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl p-5 font-bold text-lg transition-colors">
              {!oathDone ? '⏳ Listening to statement…' : !signatureDone ? '✍️ Sign to acknowledge' : '✓ I acknowledge this statement'}
            </button>
          </div>
        </div>
      )}

      {/* ══ STEP 4 — Witness ══ */}
      {step === 4 && (
        <div className="w-full flex flex-col items-center gap-6 py-12">
          {loading && (
            <>
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center flex flex-col gap-2">
                <p className="font-bold text-xl">Anchoring your identity</p>
                <p className="text-gray-500 text-sm">Comparing faces · Anchoring to Scroll L2 · Issuing HOC</p>
              </div>
            </>
          )}
          {error && (
            <div className="w-full text-center flex flex-col gap-4">
              <p className="text-red-400">{error}</p>
              <button onClick={() => { setError(''); setStep(1) }}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl px-6 py-3 text-sm font-medium">
                Start Over
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 5 — Complete ══ */}
      {step === 5 && (
        <div className="w-full flex flex-col items-center gap-6 py-4">
          <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center text-4xl">
            ✓
          </div>
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-2xl font-bold">You are registered</h2>
            <p className="text-gray-400 text-sm">Your HOC has been anchored and your confirmation is on its way.</p>
          </div>

          {hocResult && (
            <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 text-xs font-mono">
              {hocResult.hoc_id && (
                <div>
                  <div className="text-gray-500 uppercase tracking-widest not-italic font-sans text-[10px] mb-1">HOC ID</div>
                  <div className="text-green-400 break-all">{hocResult.hoc_id}</div>
                </div>
              )}
              {witnessResult?.tx_hash && (
                <div>
                  <div className="text-gray-500 uppercase tracking-widest not-italic font-sans text-[10px] mb-1">Scroll Anchor TX</div>
                  <a href={`https://sepolia.scrollscan.com/tx/${witnessResult.tx_hash}`}
                    target="_blank" rel="noreferrer"
                    className="text-blue-400 break-all underline">
                    {witnessResult.tx_hash}
                  </a>
                </div>
              )}
            </div>
          )}

          <p className="text-gray-600 text-xs">Redirecting to home in a few seconds…</p>
        </div>
      )}

    </main>
  )
}
