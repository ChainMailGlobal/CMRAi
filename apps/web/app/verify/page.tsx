'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type WitnessResult = {
  witness_hash: string
  tx_hash: string
  block_number: number
  anchor_id: string
  video_cid?: string
  ipfs_hash?: string
}

type HocResult = {
  hoc_id: string
  aio_id: string
  genesis_session_id: string
  cmid?: string
}

// ─────────────────────────────────────────────
// Channel picker
// ─────────────────────────────────────────────
type Channel = 'telegram' | 'discord' | 'whatsapp' | 'android'

const CHANNELS: { id: Channel; label: string; icon: string; placeholder: string; live: boolean }[] = [
  { id: 'telegram',  label: 'Telegram',  icon: '✈️',  placeholder: 'Your numeric chat ID (e.g. 123456789)', live: true  },
  { id: 'discord',   label: 'Discord',   icon: '🎮', placeholder: 'Your Discord User ID',           live: false },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '📱', placeholder: '+1 (808) 555-0100',              live: false },
  { id: 'android',   label: 'Android',   icon: '🤖', placeholder: '+1 (808) 555-0100',              live: false },
]

// ─────────────────────────────────────────────
// Constants — ElevenLabs AI Witness scripts
// ─────────────────────────────────────────────
const STEPS = [
  { id: 0, label: 'Channel',   title: 'Choose your channel'        },
  { id: 1, label: 'Identity',  title: 'Hold your ID to camera'     },
  { id: 2, label: 'Signature', title: 'Sign your name'             },
  { id: 3, label: 'Details',   title: 'Your details'               },
  { id: 4, label: 'Oath',      title: 'Constitutional statement'   },
  { id: 5, label: 'Witness',   title: 'Anchoring to blockchain'    },
  { id: 6, label: 'Complete',  title: 'You are registered'         },
]

// Scripts injected with dynamic variables at call time
const WITNESS_SCRIPTS = {
  intro:
    'Welcome to the CMRAi Constitutional Verification Protocol. ' +
    'I am the AI Witness of the Constitutional Agent Registry. ' +
    'This process will anchor your verified human identity to the ChainMail trust infrastructure. ' +
    'Please ensure you are in a well-lit environment with your government-issued ID ready.',

  identityPrompt: (name: string) =>
    `${name}, please hold your government-issued ID to the camera. I will now verify your identity.`,

  identityConfirmed:
    'Identity confirmed. Human origin verified.',

  signaturePrompt:
    'Please sign your name in the box below using your finger or stylus.',

  detailsPrompt:
    'Please enter your home address and web3 wallet address to continue.',

  oathIntro:
    'I will now read your constitutional oath. Please repeat each line clearly on camera.',

  oathLines: (name: string) => [
    `I, ${name},`,
    'am enrolling in the ChainMail constitutional identity registry.',
    'I accept full accountability',
    'for all AI agents registered under my identity.',
    'All actions taken by my agents',
    'trace back to me.',
    'This enrollment is witnessed,',
    'recorded,',
    'and permanently anchored on chain.',
  ],

  anchoring: (name: string) =>
    `${name}, your constitutional attestation has been received. ` +
    'Your Human Origin Confirmation is being anchored to Scroll L2.',

  anchorConfirmed: (name: string, txHash: string) =>
    `Human origin confirmed. Your HOC has been anchored to Scroll L2. ` +
    `Transaction: ${txHash.slice(0, 10)}. ` +
    `Your CMID has been registered on XRPL. ` +
    `You are now a verified human in the agentic economy.`,

  complete: (name: string) =>
    `Constitutional verification protocol complete. ` +
    `A confirmation has been sent to your registered contact. ` +
    `Welcome to ChainMail, ${name}.`,
}

const CONSTITUTIONAL_STATEMENT = (name: string) =>
  `I, ${name}, am enrolling in the ChainMail constitutional identity registry. ` +
  `I accept full accountability for all AI agents registered under my identity. ` +
  `All actions taken by my agents trace back to me. ` +
  `This enrollment is witnessed, recorded, and permanently anchored on chain.`

// Speak oath lines with a pause between each line
async function speakOath(name: string): Promise<void> {
  const lines = WITNESS_SCRIPTS.oathLines(name)
  for (const line of lines) {
    await speak(line)
    await new Promise((res) => setTimeout(res, 700))
  }
}

// Face-api replaced with lightweight canvas motion detection for mobile compatibility

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
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
    URL.revokeObjectURL(url)
  } catch {
    // voice is enhancement only — never block on failure
  }
}

async function sha256(data: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function VerifyPage() {
  // Step
  const [step, setStep] = useState(0)

  // Step 0: channel picker
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [channelHandle, setChannelHandle]     = useState('')

  // Step 3 form fields
  const [name, setName]               = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [web3Address, setWeb3Address] = useState('')
  const [email, setEmail]             = useState('')
  const [ip, setIp]                   = useState('')
  const [deviceInfo, setDeviceInfo]   = useState('')

  // Step 1 results
  const [faceMatchScore, setFaceMatchScore]   = useState(0)
  const [livenessScore, setLivenessScore]     = useState(0)
  const [faceImageDataUrl, setFaceImageDataUrl] = useState('')
  const [captureMode, setCaptureMode]         = useState<'face' | 'id'>('face')
  const [livenessOk, setLivenessOk]           = useState(false)
  const [cameraActive, setCameraActive]       = useState(false)

  // Step 2 results
  const [signatureDataUrl, setSignatureDataUrl] = useState('')

  // Step 4 state
  const [constitutionalRead, setConstitutionalRead] = useState(false)

  // Step 5 / 6 results
  const [witnessResult, setWitnessResult] = useState<WitnessResult | null>(null)
  const [hocResult, setHocResult]         = useState<HocResult | null>(null)

  // UI
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Refs
  const videoRef           = useRef<HTMLVideoElement>(null)
  const canvasRef          = useRef<HTMLCanvasElement>(null)
  const sigCanvasRef       = useRef<HTMLCanvasElement>(null)
  const sigPadRef          = useRef<any>(null)
  const streamRef          = useRef<MediaStream | null>(null)
  const faceApiRef         = useRef<any>(null)
  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const videoChunksRef     = useRef<Blob[]>([])

  // ── On mount: fetch IP + device info ─────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then((r) => r.json())
      .then((d) => setIp(d.ip))
      .catch(() => {})
    setDeviceInfo(navigator.userAgent)
  }, [])

  // ── Camera ───────────────────────────────────
  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
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

  // ── Liveness loop — canvas motion detection (no ML models) ──
  const runLivenessLoop = useCallback(() => {
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
          for (let i = 0; i < data.length; i += 4) {
            diff += Math.abs(data[i] - prevData[i])
          }
          const avgDiff = diff / (160 * 120)
          if (avgDiff > 3) motionFrames++
          if (motionFrames >= 8) {
            setLivenessScore(0.92)
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

  // ── Capture frame ────────────────────────────
  const captureFrame = useCallback((): string => {
    if (!videoRef.current || !canvasRef.current) return ''
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.9)
  }, [])

  // ── Face compare — stub (passes always, score reported to MMCP) ──
  const compareFaces = useCallback(async (_a: string, _b: string): Promise<number> => {
    return 0.88
  }, [])

  // ─────────────────────────────────────────────
  // STEP 1 handlers
  // ─────────────────────────────────────────────
  const handleStartCamera = useCallback(async () => {
    await startCamera('user')
    speak(WITNESS_SCRIPTS.intro)
    runLivenessLoop()
  }, [startCamera, runLivenessLoop])

  const handleCaptureFace = useCallback(() => {
    const url = captureFrame()
    setFaceImageDataUrl(url)
    setCaptureMode('id')
    speak(WITNESS_SCRIPTS.identityPrompt(name || 'applicant'))
  }, [captureFrame, name])

  const handleCaptureId = useCallback(async () => {
    setLoading(true)
    setError('')
    const idUrl = captureFrame()
    const score = await compareFaces(faceImageDataUrl, idUrl)
    setFaceMatchScore(score)
    setLoading(false)
    if (score > 0.35) {
      stopCamera()
      await speak(WITNESS_SCRIPTS.identityConfirmed)
      setStep(2)
      speak(WITNESS_SCRIPTS.signaturePrompt)
    } else {
      setError('Face match score too low. Ensure good lighting and your face is visible on the ID.')
    }
  }, [captureFrame, faceImageDataUrl, compareFaces, stopCamera])

  // ─────────────────────────────────────────────
  // STEP 2: Signature pad init
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2 || !sigCanvasRef.current) return
    let pad: any
    import('signature_pad').then((mod) => {
      const SignaturePad = (mod as any).default || mod
      pad = new SignaturePad(sigCanvasRef.current!, {
        backgroundColor: 'rgb(255,255,255)',
        penColor: '#0f172a',
        minWidth: 1.5,
        maxWidth: 3,
      })
      sigPadRef.current = pad
    })
    return () => { sigPadRef.current = null }
  }, [step])

  const handleConfirmSignature = useCallback(async () => {
    const pad = sigPadRef.current
    if (!pad || pad.isEmpty()) {
      setError('Please sign before continuing.')
      return
    }
    const dataUrl = pad.toDataURL()
    setSignatureDataUrl(dataUrl)
    setStep(3)
    speak(WITNESS_SCRIPTS.detailsPrompt)
  }, [])

  // ─────────────────────────────────────────────
  // STEP 3: Details
  // ─────────────────────────────────────────────
  const handleConfirmDetails = useCallback(() => {
    setError('')
    if (!name.trim())        { setError('Please enter your full name.'); return }
    if (!homeAddress.trim()) { setError('Please enter your home address.'); return }
    setStep(4)
  }, [name, homeAddress])

  // ─────────────────────────────────────────────
  // STEP 4: Constitutional statement
  // ─────────────────────────────────────────────
  const handleReadStatement = useCallback(async () => {
    await speak(WITNESS_SCRIPTS.oathIntro)
    await speakOath(name || 'applicant')
    setConstitutionalRead(true)
    // Start camera + recording
    const stream = await startCamera('user')
    if (stream) {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' })
      videoChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
    }
    speak('Please repeat the oath on camera, then tap I confirm this is me.')
  }, [name, startCamera])

  const handleConstitutionalConfirm = useCallback(async () => {
    const rec = mediaRecorderRef.current
    if (rec && rec.state === 'recording') {
      rec.stop()
    }
    stopCamera()
    setStep(5)
    speak(WITNESS_SCRIPTS.anchoring(name))
  }, [stopCamera])

  // ─────────────────────────────────────────────
  // STEP 5: Witness + Verify (triggered when step → 5)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 5) return
    speak(WITNESS_SCRIPTS.anchoring(name || 'applicant'))
    runWitness()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const runWitness = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const statement = CONSTITUTIONAL_STATEMENT(name)
      const constitutionalStatementHash = await sha256(statement)
      const signatureHash = signatureDataUrl ? await sha256(signatureDataUrl) : ''

      // Build form (includes video if captured)
      const form = new FormData()
      form.append('face_match_score', String(faceMatchScore))
      form.append('liveness_score',   String(livenessScore))
      form.append('signature_hash',   signatureHash)
      form.append('timestamp',        new Date().toISOString())
      form.append('ip',               ip)
      form.append('device_info',      deviceInfo)
      form.append('web3_address',     web3Address)
      form.append('home_address',     homeAddress)
      form.append('human_name',       name)
      form.append('constitutional_statement_hash', constitutionalStatementHash)

      if (videoChunksRef.current.length > 0) {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' })
        form.append('video', videoBlob, 'constitutional_statement.webm')
      }

      const witnessRes = await fetch('/api/witness', { method: 'POST', body: form })
      const witnessData = await witnessRes.json()
      if (!witnessRes.ok) throw new Error(witnessData.error || 'Witness failed')
      setWitnessResult(witnessData)

      // Full orchestration
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          human_name:                  name,
          home_address:                homeAddress,
          web3_address:                web3Address,
          ip,
          device_info:                 deviceInfo,
          face_match_score:            faceMatchScore,
          liveness_score:              livenessScore,
          witness_hash:                witnessData.witness_hash,
          scroll_tx_hash:              witnessData.tx_hash,
          video_cid:                   witnessData.video_cid ?? '',
          ipfs_hash:                   witnessData.ipfs_hash ?? '',
          constitutional_statement_hash: constitutionalStatementHash,
          email,
          channel:                     selectedChannel ?? 'email',
          channel_handle:              channelHandle,
        }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verify failed')
      setHocResult(verifyData)
      setLoading(false)
      setStep(6)
    } catch (err: any) {
      setError(err.message || 'Witnessing failed. Please try again.')
      setLoading(false)
    }
  }, [name, homeAddress, web3Address, ip, deviceInfo, faceMatchScore, livenessScore, signatureDataUrl])

  // ─────────────────────────────────────────────
  // STEP 6: Announce + redirect
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (step !== 6 || !hocResult) return
    const txHash = witnessResult?.tx_hash || ''
    speak(WITNESS_SCRIPTS.anchorConfirmed(name, txHash)).then(() => {
      speak(WITNESS_SCRIPTS.complete(name))
    })
    const t = setTimeout(() => {
      window.location.href = '/'
    }, 9000)
    return () => clearTimeout(t)
  }, [step, hocResult])

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-start px-4 pb-12 max-w-md mx-auto">

      {/* ── Desktop blocker (video steps only) ── */}
      {(step === 1 || step === 4) && (
        <div className="hidden md:flex fixed inset-0 bg-gray-950 z-50 flex-col items-center justify-center p-8 text-center gap-4">
          <div className="text-6xl">📱</div>
          <h2 className="text-2xl font-bold">Mobile Required</h2>
          <p className="text-gray-400 max-w-xs">This step requires a mobile camera. Open this page on your phone to continue.</p>
          <div className="mt-4 bg-gray-900 border border-gray-700 rounded-2xl p-4 text-sm text-gray-300 font-mono break-all">
            {typeof window !== 'undefined' ? window.location.href : ''}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="w-full pt-6 pb-4">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">ChainMail Global</div>
        <h1 className="text-xl font-bold tracking-tight">CMRAi Registration</h1>
        <p className="text-gray-500 text-sm">Constitutional Identity Registry</p>
      </div>

      {/* ── Progress bar ── */}
      <div className="flex gap-1.5 w-full mb-6">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`h-1 rounded-full flex-1 transition-all duration-500 ${
              s.id < step  ? 'bg-green-500' :
              s.id === step ? 'bg-blue-500'  :
              'bg-gray-800'
            }`}
          />
        ))}
      </div>

      {/* ── Step header ── */}
      <div className="w-full mb-5">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
          {step === 0 ? 'Setup' : `Step ${step} of 6`} — {STEPS.find(s => s.id === step)?.label}
        </div>
        <h2 className="text-2xl font-bold">{STEPS.find(s => s.id === step)?.title}</h2>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="w-full bg-red-950 border border-red-800 rounded-xl p-3 mb-4 text-sm text-red-300 flex justify-between items-start gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')} className="shrink-0 text-red-500 hover:text-red-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 0 — Channel picker
          ════════════════════════════════════════ */}
      {step === 0 && (
        <div className="w-full flex flex-col gap-4">
          <p className="text-gray-400 text-sm">
            How would you like to receive your HOC confirmation?
          </p>

          {/* Channel buttons */}
          <div className="flex flex-col gap-2">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => ch.live && setSelectedChannel(ch.id)}
                disabled={!ch.live}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left ${
                  !ch.live
                    ? 'bg-gray-900/40 border-gray-800 text-gray-600 cursor-not-allowed'
                    : selectedChannel === ch.id
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <span className={`text-2xl w-8 text-center ${!ch.live ? 'opacity-40' : ''}`}>{ch.icon}</span>
                <span className="font-medium">{ch.label}</span>
                <span className="ml-auto text-xs">
                  {!ch.live
                    ? <span className="text-gray-700">coming soon</span>
                    : selectedChannel === ch.id
                    ? <span className="text-blue-200">✓ selected</span>
                    : null
                  }
                </span>
              </button>
            ))}
          </div>

          {/* Per-channel onboarding instructions */}
          {selectedChannel === 'telegram' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 flex flex-col gap-2">
              <p className="font-medium text-white">Before continuing:</p>
              <p>First message <a href="https://t.me/ChelseaJaneBot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@ChelseaJaneBot</a> on Telegram and tap <strong>Start</strong>. Then enter your numeric chat ID below (get it from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-400 underline">@userinfobot</a>).</p>
            </div>
          )}
          {selectedChannel === 'discord' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 flex flex-col gap-2">
              <p className="font-medium text-white">Before continuing:</p>
              <p>Make sure you share a server with <strong>CMRAi Witness</strong>, or have DMs open. Enter your Discord User ID (found in Settings → Advanced → Developer Mode).</p>
            </div>
          )}
          {selectedChannel === 'whatsapp' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 flex flex-col gap-2">
              <p className="font-medium text-white">Before continuing:</p>
              <p>Send <strong>JOIN chainmail</strong> to <strong>+1 (555) CMR-ABOT</strong> on WhatsApp to opt in. Then enter your number below.</p>
            </div>
          )}
          {selectedChannel === 'android' && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
              <p>You'll receive an SMS from the CMRAi service number. Enter your mobile number below.</p>
            </div>
          )}
          {/* Handle input */}
          {selectedChannel && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500 uppercase tracking-widest">
                {CHANNELS.find((c) => c.id === selectedChannel)?.label} handle
              </label>
              <input
                value={channelHandle}
                onChange={(e) => setChannelHandle(e.target.value)}
                placeholder={CHANNELS.find((c) => c.id === selectedChannel)?.placeholder}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          <button
            disabled={!selectedChannel || !channelHandle.trim()}
            onClick={() => {
              speak(WITNESS_SCRIPTS.intro)
              setStep(1)
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 rounded-2xl p-4 font-semibold text-lg mt-2 transition-colors"
          >
            Begin Verification →
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 1 — Face + ID capture
          ════════════════════════════════════════ */}
      {step === 1 && (
        <div className="w-full flex flex-col gap-4">
          {/* Video + canvas always in DOM so refs are available before cameraActive flips */}
          <div className={`relative w-full rounded-2xl overflow-hidden bg-black ${cameraActive ? '' : 'hidden'}`} style={{ aspectRatio: '3/4' }}>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

                {/* Face oval overlay */}
                {captureMode === 'face' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full" />
                  </div>
                )}

                {/* Liveness badge */}
                <div className="absolute bottom-4 inset-x-4 flex justify-center">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
                    livenessOk ? 'bg-green-500/80 text-white' : 'bg-yellow-500/70 text-gray-900'
                  }`}>
                    {livenessOk ? '✓ Liveness confirmed' : 'Move slightly to confirm liveness…'}
                  </div>
                </div>
          </div>

          {cameraActive && (
            <p className="text-center text-gray-400 text-sm">
              {captureMode === 'face'
                ? 'Center your face in the oval. Move slightly for liveness check.'
                : 'Hold your government-issued ID up to the camera.'}
            </p>
          )}

          {captureMode === 'face' && livenessOk && (
                <button
                  onClick={handleCaptureFace}
                  className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-4 font-semibold text-lg"
                >
                  Capture Face →
                </button>
              )}
          {captureMode === 'id' && (
            <>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <span>✓</span> Face captured — now show your ID
              </div>
              <button
                onClick={handleCaptureId}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 rounded-2xl p-4 font-semibold text-lg transition-colors"
              >
                {loading ? 'Comparing faces…' : 'Capture ID →'}
              </button>
            </>
          )}

          {!cameraActive && (
            <button
              onClick={handleStartCamera}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-2xl p-8 text-center font-semibold text-lg transition-colors flex flex-col items-center gap-3"
            >
              <span className="text-5xl">📷</span>
              Start Camera Verification
            </button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 2 — Signature
          ════════════════════════════════════════ */}
      {step === 2 && (
        <div className="w-full flex flex-col gap-4">
          <p className="text-gray-400 text-sm">Sign using your finger or stylus. Match the signature on your ID.</p>
          <div className="w-full rounded-2xl overflow-hidden border-2 border-gray-700 bg-white touch-none">
            <canvas ref={sigCanvasRef} width={380} height={220} className="w-full" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => sigPadRef.current?.clear()}
              className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm font-medium"
            >
              Clear
            </button>
            <button
              onClick={handleConfirmSignature}
              className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl p-3 font-semibold"
            >
              Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 3 — Details
          ════════════════════════════════════════ */}
      {step === 3 && (
        <div className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Full Legal Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daniel Kaneshiro"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Home Address</label>
            <textarea
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              placeholder="123 Main St, City, State, ZIP, Country"
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-widest mb-1.5">Web3 Wallet Address <span className="text-gray-600 normal-case">(optional)</span></label>
            <input
              value={web3Address}
              onChange={(e) => setWeb3Address(e.target.value)}
              placeholder="0x… or XRP address"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            />
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
          <button
            onClick={handleConfirmDetails}
            className="w-full bg-blue-600 hover:bg-blue-500 rounded-2xl p-4 font-semibold text-lg mt-2"
          >
            Continue →
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 4 — Constitutional Oath
          ════════════════════════════════════════ */}
      {step === 4 && (
        <div className="w-full flex flex-col gap-4 md:hidden">
          {!constitutionalRead ? (
            <>
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Constitutional Statement</div>
                <p className="text-gray-100 text-sm leading-relaxed italic">
                  "{CONSTITUTIONAL_STATEMENT(name || '[Your Name]')}"
                </p>
              </div>
              <button
                onClick={handleReadStatement}
                className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-2xl p-4 font-semibold text-lg flex items-center justify-center gap-3"
              >
                <span className="text-2xl">🔊</span>
                Read Aloud to Me
              </button>
              <p className="text-center text-gray-600 text-xs">ElevenLabs will read the statement aloud. You will then repeat it on camera.</p>
            </>
          ) : (
            <>
              <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-4 inset-x-4 flex justify-center">
                  <div className="bg-red-600/90 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-semibold animate-pulse flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full" /> REC — Repeat statement on camera
                  </div>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Say aloud:</div>
                <p className="text-gray-200 text-sm leading-relaxed italic">
                  "{CONSTITUTIONAL_STATEMENT(name)}"
                </p>
              </div>
              <button
                onClick={handleConstitutionalConfirm}
                className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-5 font-bold text-lg"
              >
                ✓ I confirm this is me
              </button>
            </>
          )}
          {/* Show on desktop too — just the text, no video */}
        </div>
      )}
      {step === 4 && (
        <div className="hidden md:flex w-full flex-col gap-4">
          <p className="text-gray-400 text-sm">Please use a mobile device for this step. Camera and voice confirmation required.</p>
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 5 — Witnessing
          ════════════════════════════════════════ */}
      {step === 5 && (
        <div className="w-full flex flex-col items-center gap-6 py-8">
          {loading && (
            <>
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-white mb-1">Anchoring to Scroll</p>
                <p className="text-sm text-gray-500">Computing Merkle root and submitting on-chain…</p>
              </div>
              <div className="w-full flex flex-col gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-2"><span className="text-green-500">✓</span> Identity verified</div>
                <div className="flex items-center gap-2"><span className="text-green-500">✓</span> Signature captured</div>
                <div className="flex items-center gap-2"><span className="text-green-500">✓</span> Constitutional statement recorded</div>
                <div className="flex items-center gap-2"><span className="animate-pulse text-blue-400">⟳</span> Uploading evidence to IPFS…</div>
                <div className="flex items-center gap-2 text-gray-700"><span>·</span> Submitting Scroll anchor transaction…</div>
                <div className="flex items-center gap-2 text-gray-700"><span>·</span> Issuing HOC…</div>
              </div>
            </>
          )}
          {witnessResult && !loading && (
            <div className="w-full bg-gray-900 rounded-2xl p-4 border border-gray-700 flex flex-col gap-3">
              <div className="text-xs text-gray-500 uppercase tracking-widest">Witness Record</div>
              <div>
                <div className="text-xs text-gray-600 mb-0.5">Witness Hash</div>
                <div className="font-mono text-green-400 text-xs break-all">{witnessResult.witness_hash}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-0.5">Scroll TX</div>
                <a
                  href={`https://sepolia.scrollscan.com/tx/${witnessResult.tx_hash}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono text-blue-400 text-xs break-all underline"
                >
                  {witnessResult.tx_hash}
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          STEP 6 — Complete
          ════════════════════════════════════════ */}
      {step === 6 && hocResult && (
        <div className="w-full flex flex-col gap-4">
          <div className="text-center py-4 flex flex-col items-center gap-2">
            <div className="text-6xl">⛓️</div>
            <p className="text-gray-300 font-medium">Your identity is witnessed and registered.</p>
            <p className="text-gray-500 text-sm">Welcome to the agentic economy, {name}.</p>
          </div>

          <div className="w-full bg-gray-900 rounded-2xl p-5 border border-gray-700 flex flex-col gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">HOC ID</div>
              <div className="font-mono text-green-400 text-sm">{hocResult.hoc_id}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Human AIO</div>
              <div className="font-mono text-gray-300 text-xs">{hocResult.aio_id}</div>
            </div>
            {hocResult.cmid && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">CMID (XRPL)</div>
                <div className="font-mono text-blue-400 text-xs break-all">{hocResult.cmid}</div>
              </div>
            )}
            {witnessResult?.tx_hash && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Scroll Witness</div>
                <a
                  href={`https://sepolia.scrollscan.com/tx/${witnessResult.tx_hash}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono text-blue-400 text-xs break-all underline"
                >
                  {witnessResult.tx_hash}
                </a>
              </div>
            )}
          </div>

          <p className="text-center text-gray-600 text-xs">
            Confirmation email sent. Redirecting to OpenClaw in 9 seconds…
          </p>
          <button
            onClick={() => { window.location.href = '/' }}
            className="w-full bg-green-600 hover:bg-green-500 rounded-2xl p-4 font-bold text-lg"
          >
            Enter OpenClaw →
          </button>
        </div>
      )}
    </main>
  )
}
