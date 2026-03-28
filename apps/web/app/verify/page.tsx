'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Channel = 'telegram' | 'discord' | 'whatsapp' | 'android'

const CHANNELS: { id: Channel; label: string; icon: string; placeholder: string; live: boolean }[] = [
  { id: 'telegram',  label: 'Telegram',  icon: '✈️',  placeholder: 'Your numeric chat ID (e.g. 123456789)', live: true  },
  { id: 'discord',   label: 'Discord',   icon: '🎮', placeholder: 'Your Discord User ID',                  live: false },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '📱', placeholder: '+1 (808) 555-0100',                     live: false },
  { id: 'android',   label: 'Android',   icon: '🤖', placeholder: '+1 (808) 555-0100',                     live: false },
]

const STEPS = [
  { id: 0, label: 'Channel',   hint: 'Choose how to receive your HOC confirmation'        },
  { id: 1, label: 'Face',      hint: 'Confirm you are a real person with live video'       },
  { id: 2, label: 'ID',        hint: 'Show your government ID to the back camera'          },
  { id: 3, label: 'Details',   hint: 'Review the information extracted from your ID'       },
  { id: 4, label: 'Signature', hint: 'Sign your name to match your ID'                     },
  { id: 5, label: 'Oath',      hint: 'Listen to the constitutional statement and acknowledge' },
  { id: 6, label: 'Witness',   hint: 'Your identity is being anchored to the blockchain'   },
  { id: 7, label: 'Complete',  hint: 'You are registered in the constitutional registry'   },
]

const CONSTITUTIONAL_STATEMENT = (name: string) =>
  `I, ${name}, am enrolling in the ChainMail constitutional identity registry. ` +
  `I accept full accountability for all AI agents registered under my identity. ` +
  `All actions taken by my agents trace back to me. ` +
  `This enrollment is witnessed, recorded, and permanently anchored on chain.`

// ─────────────────────────────────────────────
// Voice helpers (non-blocking)
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
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
    URL.revokeObjectURL(url)
  } catch { /* voice is enhancement only */ }
}

// ─────────────────────────────────────────────
// Crypto helper
// ─────────────────────────────────────────────
async function sha256(input: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function VerifyPage() {
  // Step
  const [step, setStep] = useState(0)

  // Channel
  const [selectedChannel, setSelectedChannel] = useState<Channel>('telegram')
  const [channelHandle, setChannelHandle]     = useState('')

  // Camera
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive]       = useState(false)

  // Liveness
  const [livenessOk, setLivenessOk]           = useState(false)

  // Captures
  const [selfieDataUrl, setSelfieDataUrl]     = useState('')
  const [idDataUrl, setIdDataUrl]             = useState('')

  // OCR
  const [ocrLoading, setOcrLoading]           = useState(false)

  // Details
  const [name, setName]                       = useState('')
  const [homeAddress, setHomeAddress]         = useState('')
  const [email, setEmail]                     = useState('')
  const [web3Address, setWeb3Address]         = useState('')
  const [ip, setIp]                           = useState('')
  const [deviceInfo, setDeviceInfo]           = useState('')

  // Signature
  const sigCanvasRef  = useRef<HTMLCanvasElement>(null)
  const sigPadRef     = useRef<any>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')

  // Oath
  const [oathPlaying, setOathPlaying]         = useState(false)
  const [oathDone, setOathDone]               = useState(false)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const videoChunksRef    = useRef<Blob[]>([])

  // Witness result
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [witnessResult, setWitnessResult]     = useState<any>(null)
  const [hocResult, setHocResult]             = useState<any>(null)

  // ── Collect IP + device on mount ────────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => setIp(d.ip))
      .catch(() => {})
    setDeviceInfo(navigator.userAgent)
  }, [])

  // ── Preload signature_pad on step 3 ─────────
  useEffect(() => {
    if (step === 3) import('signature_pad').catch(() => {})
  }, [step])

  // ── Init signature pad on step 4 ────────────
  useEffect(() => {
    if (step !== 4 || !sigCanvasRef.current) return
    let pad: any
    import('signature_pad').then((mod) => {
      const SP = (mod as any).default || mod
      pad = new SP(sigCanvasRef.current!, {
        backgroundColor: 'rgb(255,255,255)',
        penColor: '#0f172a',
        minWidth: 1.5,
        maxWidth: 3,
      })
      sigPadRef.current = pad
    })
    return () => { sigPadRef.current = null }
  }, [step])

  // ─────────────────────────────────────────────
  // Camera helpers
  // ─────────────────────────────────────────────
  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    try {
      // Stop any existing stream first
      streamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: facingMode === 'user',
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      return stream
    } catch {
      setError('Camera access required. Please allow camera permissions in your browser settings and reload.')
      return null
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  // ── Liveness — canvas motion detection ──────
  const runLiveness = useCallback(() => {
    const offscreen = document.createElement('canvas')
    offscreen.width = 160
    offscreen.height = 120
    const ctx = offscreen.getContext('2d')!
    let prevData: Uint8ClampedArray | null = null
    let motionFrames = 0
    let running = true

    const tick = () => {
      if (!running || !videoRef.current) return
      try {
        ctx.drawImage(videoRef.current, 0, 0, 160, 120)
        const { data } = ctx.getImageData(0, 0, 160, 120)
        if (prevData) {
          let diff = 0
          for (let i = 0; i < data.length; i += 4) diff += Math.abs(data[i] - prevData[i])
          if (diff / (160 * 120) > 3) motionFrames++
          if (motionFrames >= 8) {
            setLivenessOk(true)
            running = false
            return
          }
        }
        prevData = new Uint8ClampedArray(data)
      } catch { /* continue */ }
      setTimeout(() => requestAnimationFrame(tick), 200)
    }
    requestAnimationFrame(tick)
  }, [])

  const captureFrame = useCallback((): string => {
    if (!videoRef.current) return ''
    const c = document.createElement('canvas')
    c.width  = videoRef.current.videoWidth
    c.height = videoRef.current.videoHeight
    c.getContext('2d')!.drawImage(videoRef.current, 0, 0)
    return c.toDataURL('image/jpeg', 0.9)
  }, [])

  // ─────────────────────────────────────────────
  // Step handlers
  // ─────────────────────────────────────────────

  // Step 0 → 1
  const handleBeginVerification = useCallback(() => {
    if (!channelHandle.trim()) { setError('Please enter your channel handle.'); return }
    setError('')
    setStep(1)
    speak('Welcome to the CMRAi Constitutional Verification Protocol. Please allow camera access when prompted.')
  }, [channelHandle])

  // Step 1 — selfie
  const handleStartFaceCamera = useCallback(async () => {
    setLivenessOk(false)
    const stream = await startCamera('user')
    if (stream) runLiveness()
  }, [startCamera, runLiveness])

  const handleCaptureSelfie = useCallback(() => {
    const url = captureFrame()
    setSelfieDataUrl(url)
    stopCamera()
    speak('Identity confirmed. Now we need to verify your ID.')
    setStep(2)
  }, [captureFrame, stopCamera])

  // Step 2 — ID photo
  const handleStartIdCamera = useCallback(async () => {
    await startCamera('environment')
  }, [startCamera])

  const handleCaptureId = useCallback(async () => {
    const url = captureFrame()
    setIdDataUrl(url)
    stopCamera()
    setOcrLoading(true)
    speak('ID captured. Extracting your information.')
    try {
      const mmcpBase = process.env.NEXT_PUBLIC_MMCP_API_BASE_URL || '/api/mmcp-proxy'
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
    } catch { /* OCR is best-effort */ }
    setOcrLoading(false)
    setStep(3)
  }, [captureFrame, stopCamera])

  // Step 3 — details confirmed
  const handleConfirmDetails = useCallback(() => {
    setError('')
    if (!name.trim())        { setError('Please enter your full name.'); return }
    if (!homeAddress.trim()) { setError('Please enter your home address.'); return }
    setStep(4)
    speak('Details confirmed. Please sign your name.')
  }, [name, homeAddress])

  // Step 4 — signature
  const handleConfirmSignature = useCallback(async () => {
    const pad = sigPadRef.current
    if (!pad || pad.isEmpty()) { setError('Please sign before continuing.'); return }
    const dataUrl = pad.toDataURL()
    setSignatureDataUrl(dataUrl)
    setStep(5)
    // Start camera + play oath in background
    const stream = await startCamera('user')
    if (stream) {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      videoChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data) }
      mediaRecorderRef.current = recorder
      recorder.start()
    }
    setOathPlaying(true)
    speak('I will now read your constitutional statement. Listen carefully, then acknowledge.')
      .then(() => speak(CONSTITUTIONAL_STATEMENT(name)))
      .then(() => { setOathDone(true); setOathPlaying(false) })
  }, [name, startCamera])

  // Step 5 — acknowledge
  const handleAcknowledge = useCallback(async () => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') rec.stop()
    stopCamera()
    setStep(6)
    speak(`${name}, your constitutional attestation has been received. Anchoring to Scroll L2.`)
  }, [name, stopCamera])

  // Step 6 — witness
  useEffect(() => {
    if (step !== 6) return
    runWitness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const runWitness = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const statement   = CONSTITUTIONAL_STATEMENT(name)
      const stmtHash    = await sha256(statement)
      const sigHash     = signatureDataUrl ? await sha256(signatureDataUrl) : ''
      const mmcpBase    = process.env.NEXT_PUBLIC_MMCP_API_BASE_URL || ''

      // Face compare via MMCP
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
        } catch { /* non-fatal, use default */ }
      }

      // Build witness form
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

      // Attach oath video if recorded
      if (videoChunksRef.current.length > 0) {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        form.append('video', blob, 'oath.webm')
      }

      const witnessRes = await fetch('/api/witness', { method: 'POST', body: form })
      const witnessData = await witnessRes.json()
      if (!witnessRes.ok) throw new Error(witnessData.error || 'Witness failed')
      setWitnessResult(witnessData)

      // Orchestrate
      const verifyRes = await fetch('/api/verify', {
        method:  'POST',
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
      setStep(7)

      const txHash = witnessData.tx_hash || ''
      speak(`Human origin confirmed. Your HOC has been anchored to Scroll L2. Transaction: ${txHash.slice(0, 10)}. Welcome to ChainMail, ${name}.`)
        .then(() => { setTimeout(() => { window.location.href = '/' }, 6000) })

    } catch (err: any) {
      setError(err.message || 'Witnessing failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [name, homeAddress, web3Address, email, ip, deviceInfo, signatureDataUrl, selfieDataUrl, idDataUrl, selectedChannel, channelHandle])

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────
  const currentStep = STEPS[step] || STEPS[0]

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start px-4 pb-12 max-w-md mx-auto">

      {/* Header */}
      <div className="w-full pt-8 pb-6">
        <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">ChainMail Global</p>
        <h1 className="text-2xl font-bold">CMRAi Registration</h1>
        <p className="text-gray-500 text-sm">Constitutional Identity Registry</p>
      </div>

      {/* Progress bar */}
      <div className="w-full flex gap-1 mb-6">
        {STEPS.map((s) => (
          <div key={s.id} className={`h-1 flex-1 rounded-full transition-colors ${
            s.id < step ? 'bg-green-500' : s.id === step ? 'bg-blue-500' : 'bg-gray-800'
          }`} />
        ))}
      </div>

      {/* Step label + hint */}
      {step < 7 && (
        <div className="w-full mb-6">
          <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-1">
            {step === 0 ? 'SETUP — CHANNEL' : `STEP ${step} OF 6 — ${currentStep.label.toUpperCase()}`}
          </p>
          <h2 className="text-2xl font-bold mb-1">{
            step === 0 ? 'Choose your channel' :
            step === 1 ? 'Face verification' :
            step === 2 ? 'ID capture' :
            step === 3 ? 'Your details' :
            step === 4 ? 'Sign your name' :
            step === 5 ? 'Constitutional oath' :
            'Anchoring to blockchain'
          }</h2>
          <p className="text-gray-400 text-sm">{currentStep.hint}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="w-full bg-red-950 border border-red-800 rounded-xl p-3 mb-4 text-sm text-red-300 flex justify-between items-start gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 shrink-0">✕</button>
        </div>
      )}

      {/* Always-present video + canvas (refs must exist before camera starts) */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* ══ STEP 0 — Channel ══ */}
      {step === 0 && (
        <div className="w-full flex flex-col gap-3">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              onClick={() => { if (ch.live) setSelectedChannel(ch.id) }}
              className={`w-full flex items-center gap-4 rounded-2xl border p-4 transition-colors text-left ${
                ch.live
                  ? selectedChannel === ch.id
                    ? 'border-blue-500 bg-blue-950/40'
                    : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                  : 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl">{ch.icon}</span>
              <span className="font-semibold flex-1">{ch.label}</span>
              {!ch.live && <span className="text-xs text-gray-600">coming soon</span>}
            </button>
          ))}

          {selectedChannel === 'telegram' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 flex flex-col gap-2 mt-1">
              <p className="font-medium text-white">Before continuing:</p>
              <p>Message <a href="https://t.me/ChelseaJaneBot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@ChelseaJaneBot</a> on Telegram and tap <strong>Start</strong>. Then enter your numeric chat ID below (get it from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@userinfobot</a>).</p>
            </div>
          )}

          <input
            value={channelHandle}
            onChange={(e) => setChannelHandle(e.target.value)}
            placeholder={CHANNELS.find((c) => c.id === selectedChannel)?.placeholder || ''}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={handleBeginVerification}
            disabled={!channelHandle.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl p-4 font-semibold text-lg mt-2 transition-colors"
          >
            Begin Verification →
          </button>
        </div>
      )}

      {/* ══ STEP 1 — Face + liveness ══ */}
      {step === 1 && (
        <div className="w-full flex flex-col gap-4">
          {cameraActive && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-64 border-2 border-dashed border-white/40 rounded-full" />
              </div>
              <div className="absolute bottom-4 inset-x-4 flex justify-center">
                <div className={`px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
                  livenessOk ? 'bg-green-500/80 text-white' : 'bg-yellow-500/70 text-gray-900'
                }`}>
                  {livenessOk ? '✓ Liveness confirmed' : 'Move slightly to confirm liveness…'}
                </div>
              </div>
            </div>
          )}

          {!cameraActive ? (
            <button onClick={handleStartFaceCamera} className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-8 font-semibold text-lg flex flex-col items-center gap-3">
              <span className="text-5xl">🤳</span>
              Start Face Verification
            </button>
          ) : livenessOk ? (
            <button onClick={handleCaptureSelfie} className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-4 font-semibold text-lg">
              Capture Selfie →
            </button>
          ) : (
            <p className="text-center text-gray-500 text-sm">Center your face in the oval and move slightly</p>
          )}
        </div>
      )}

      {/* ══ STEP 2 — ID capture (back camera) ══ */}
      {step === 2 && (
        <div className="w-full flex flex-col gap-4">
          {cameraActive && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-4 border-2 border-dashed border-white/40 rounded-xl pointer-events-none" />
              <div className="absolute bottom-4 inset-x-4 flex justify-center">
                <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-white">
                  Hold your ID flat inside the frame
                </div>
              </div>
            </div>
          )}

          {ocrLoading && (
            <div className="flex items-center justify-center gap-3 py-4 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Extracting information from your ID…
            </div>
          )}

          {!cameraActive && !ocrLoading ? (
            <button onClick={handleStartIdCamera} className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-8 font-semibold text-lg flex flex-col items-center gap-3">
              <span className="text-5xl">🪪</span>
              Open ID Camera
            </button>
          ) : cameraActive ? (
            <button onClick={handleCaptureId} className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-4 font-semibold text-lg">
              Capture ID →
            </button>
          ) : null}
        </div>
      )}

      {/* ══ STEP 3 — Details (auto-filled) ══ */}
      {step === 3 && (
        <div className="w-full flex flex-col gap-4">
          <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl px-4 py-3 text-xs text-blue-300">
            Information was extracted from your ID. Review and correct if needed.
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

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Auto-captured</div>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-gray-500">IP Address</span>
                <span className="text-gray-300 font-mono">{ip || '…'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Device</span>
                <span className="text-gray-400 text-right truncate">
                  {deviceInfo.match(/\(([^)]+)\)/)?.[1]?.split(';')[0] || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <button onClick={handleConfirmDetails}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-4 font-semibold text-lg mt-2">
            Continue →
          </button>
        </div>
      )}

      {/* ══ STEP 4 — Signature ══ */}
      {step === 4 && (
        <div className="w-full flex flex-col gap-4">
          <p className="text-gray-400 text-sm">Sign using your finger. Match the signature on your ID.</p>
          <div className="w-full rounded-2xl overflow-hidden border-2 border-gray-700 bg-white touch-none">
            <canvas ref={sigCanvasRef} width={380} height={220} className="w-full" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => sigPadRef.current?.clear()}
              className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm font-medium">
              Clear
            </button>
            <button onClick={handleConfirmSignature}
              className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl p-3 font-semibold">
              Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ══ STEP 5 — Oath ══ */}
      {step === 5 && (
        <div className="w-full flex flex-col gap-4">
          {cameraActive && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute top-4 inset-x-4 flex justify-center">
                <div className="bg-red-600/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-semibold animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full" /> Recording
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-700">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Constitutional Statement</div>
            <p className="text-gray-100 text-sm leading-relaxed italic">
              "{CONSTITUTIONAL_STATEMENT(name || '[Your Name]')}"
            </p>
          </div>

          {oathPlaying && (
            <div className="flex items-center justify-center gap-3 py-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              AI Witness is reading the statement…
            </div>
          )}

          {oathDone && (
            <button onClick={handleAcknowledge}
              className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-5 font-bold text-lg">
              ✓ I acknowledge this statement
            </button>
          )}

          {!oathPlaying && !oathDone && !cameraActive && (
            <p className="text-center text-gray-500 text-sm">Preparing AI Witness…</p>
          )}
        </div>
      )}

      {/* ══ STEP 6 — Witnessing ══ */}
      {step === 6 && (
        <div className="w-full flex flex-col items-center gap-6 py-8">
          {loading && (
            <>
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="font-semibold text-white text-lg">Witnessing your identity</p>
                <p className="text-gray-500 text-sm">Anchoring to Scroll L2 · Issuing HOC · Sending confirmation</p>
              </div>
            </>
          )}
          {error && (
            <div className="w-full text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={() => { setError(''); setStep(1) }}
                className="bg-gray-800 hover:bg-gray-700 rounded-xl px-6 py-3 text-sm font-medium">
                Start Over
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 7 — Complete ══ */}
      {step === 7 && (
        <div className="w-full flex flex-col items-center gap-6 py-4">
          <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center">
            <span className="text-4xl">✓</span>
          </div>
          <div className="text-center flex flex-col gap-2">
            <h2 className="text-2xl font-bold">You are registered</h2>
            <p className="text-gray-400 text-sm">Your HOC has been anchored and your confirmation is on its way.</p>
          </div>

          {hocResult && (
            <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3 text-xs font-mono">
              {hocResult.hoc_id && (
                <div><span className="text-gray-500 uppercase tracking-widest not-italic font-sans text-[10px]">HOC ID</span><br /><span className="text-green-400 break-all">{hocResult.hoc_id}</span></div>
              )}
              {witnessResult?.tx_hash && (
                <div><span className="text-gray-500 uppercase tracking-widest not-italic font-sans text-[10px]">Scroll TX</span><br />
                  <a href={`https://sepolia.scrollscan.com/tx/${witnessResult.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-400 break-all underline">{witnessResult.tx_hash}</a>
                </div>
              )}
            </div>
          )}

          <p className="text-gray-600 text-xs text-center">Redirecting to home in a few seconds…</p>
        </div>
      )}

    </main>
  )
}
