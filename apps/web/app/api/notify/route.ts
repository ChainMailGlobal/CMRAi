import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/notify
 *
 * Dispatches the HOC confirmation message to the user's chosen channel.
 *
 * Body:
 *   channel        'imessage' | 'telegram' | 'discord' | 'whatsapp' | 'android' | 'email'
 *   channel_handle  phone / username / webhook depending on channel
 *   message         full confirmation text
 *   hoc_id
 *   cmid
 *   witness_hash
 *   scroll_tx_hash
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { channel, channel_handle, message, hoc_id, cmid, witness_hash, scroll_tx_hash } = body

  switch (channel) {
    case 'telegram': return sendTelegram(channel_handle, message)
    case 'discord':  return sendDiscord(channel_handle, message)
    case 'whatsapp': return sendWhatsApp(channel_handle, message, hoc_id)
    case 'imessage': return sendIMessage(channel_handle, message)
    case 'android':  return sendAndroid(channel_handle, message)
    default:         return NextResponse.json({ error: 'unknown channel' }, { status: 400 })
  }
}

// ─────────────────────────────────────────────────────────
// Telegram — Bot API sendMessage
// ─────────────────────────────────────────────────────────
async function sendTelegram(handle: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' })

  // handle = @username or numeric chat_id
  const chatId = handle.startsWith('@') ? handle : handle.replace(/\D/g, '')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.description)
    return NextResponse.json({ ok: true, channel: 'telegram', message_id: data.result?.message_id })
  } catch (err: any) {
    console.error('[notify/telegram]', err.message)
    return NextResponse.json({ ok: false, channel: 'telegram', error: err.message })
  }
}

// ─────────────────────────────────────────────────────────
// Discord — Webhook or Bot DM
// ─────────────────────────────────────────────────────────
async function sendDiscord(handle: string, text: string) {
  const botToken   = process.env.DISCORD_BOT_TOKEN
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL

  // If handle looks like a webhook URL, use it directly
  const targetUrl = handle.startsWith('https://discord.com/api/webhooks')
    ? handle
    : webhookUrl

  if (targetUrl) {
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      return NextResponse.json({ ok: res.ok, channel: 'discord' })
    } catch (err: any) {
      return NextResponse.json({ ok: false, channel: 'discord', error: err.message })
    }
  }

  // Bot DM — handle is a Discord user ID
  if (botToken && handle) {
    try {
      // Create DM channel first
      const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({ recipient_id: handle.replace(/\D/g, '') }),
      })
      const dmData = await dmRes.json()
      if (!dmData.id) throw new Error('Could not create DM channel')

      const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({ content: text }),
      })
      const msgData = await msgRes.json()
      return NextResponse.json({ ok: !!msgData.id, channel: 'discord', message_id: msgData.id })
    } catch (err: any) {
      return NextResponse.json({ ok: false, channel: 'discord', error: err.message })
    }
  }

  return NextResponse.json({ ok: false, channel: 'discord', error: 'DISCORD_BOT_TOKEN or DISCORD_WEBHOOK_URL not set' })
}

// ─────────────────────────────────────────────────────────
// WhatsApp — Meta Cloud API
// ─────────────────────────────────────────────────────────
async function sendWhatsApp(phone: string, text: string, hoc_id: string) {
  const token   = process.env.WHATSAPP_API_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return NextResponse.json({ ok: false, channel: 'whatsapp', error: 'WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set' })
  }

  // Normalise to E.164
  const to = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: !!data.messages?.[0]?.id, channel: 'whatsapp', message_id: data.messages?.[0]?.id })
  } catch (err: any) {
    return NextResponse.json({ ok: false, channel: 'whatsapp', error: err.message })
  }
}

// ─────────────────────────────────────────────────────────
// Android SMS — Twilio
// ─────────────────────────────────────────────────────────
async function sendAndroid(phone: string, text: string) {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) {
    return NextResponse.json({ ok: false, channel: 'android', error: 'Twilio credentials not set (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)' })
  }

  const to = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
      body: new URLSearchParams({ From: from, To: to, Body: text }).toString(),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.status !== 'failed', channel: 'android', sid: data.sid })
  } catch (err: any) {
    return NextResponse.json({ ok: false, channel: 'android', error: err.message })
  }
}


// ─────────────────────────────────────────────────────────
// iMessage — Photon relay
// ─────────────────────────────────────────────────────────
async function sendIMessage(phone: string, text: string) {
  const token = process.env.PHOTON_API_TOKEN
  const base  = process.env.PHOTON_API_BASE || 'https://api.photon.codes'

  if (!token) {
    return NextResponse.json({ ok: false, channel: 'imessage', error: 'PHOTON_API_TOKEN not set' })
  }

  const to = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`

  try {
    const res = await fetch(`${base}/v1/messages/imessage`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ recipients: [to], content: text }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: res.ok, channel: 'imessage', data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, channel: 'imessage', error: err.message })
  }
}
