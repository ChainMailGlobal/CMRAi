import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''
// CMRAi AI Witness voice — use ElevenLabs "Rachel" or a custom cloned voice
// Override via ELEVENLABS_WITNESS_VOICE_ID env var
const WITNESS_VOICE_ID = process.env.ELEVENLABS_WITNESS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL' // "Sarah" — authoritative, calm

/**
 * POST /api/voice/speak
 *
 * Calls ElevenLabs TTS to synthesize the CMRAi AI Witness voice.
 * Returns raw audio/mpeg stream to the client.
 *
 * Body: { text: string, voice_id?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice_id } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }

    if (!ELEVENLABS_API_KEY) {
      // Graceful degradation — return empty audio so UI doesn't break
      return new NextResponse(null, {
        status: 204,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    }

    const resolvedVoiceId = voice_id || WITNESS_VOICE_ID

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':   ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability:        0.72,
            similarity_boost: 0.80,
            style:            0.15,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!ttsRes.ok) {
      const errText = await ttsRes.text()
      console.error('[voice/speak] ElevenLabs error:', ttsRes.status, errText)
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 })
    }

    const audioBuffer = await ttsRes.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type':  'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    console.error('[voice/speak] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
