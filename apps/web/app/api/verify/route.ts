import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const getSupabase = () => createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const getResend = () => new Resend(process.env.RESEND_API_KEY || '')

const MMCP_BASE     = process.env.MMCP_API_BASE_URL  || 'http://localhost:5000'
const FROM_EMAIL    = process.env.RESEND_FROM_EMAIL  || 'CMRAi <noreply@chainmail.global>'
const TO_EMAIL      = process.env.RESEND_TO_EMAIL    || 'daniel@chainmail.global'
const PHOTON_TOKEN  = process.env.PHOTON_API_TOKEN   || ''
const PHOTON_BASE   = process.env.PHOTON_API_BASE    || 'https://api.photon.codes'

/**
 * POST /api/verify
 *
 * Main orchestration endpoint. Called by page.tsx after /api/witness succeeds.
 *
 * Flow:
 *   1. Issue HOC via MMCP /mmcp/hoc
 *   2. Mint CMID on XRPL via /api/cmid/mint (best-effort)
 *   3. Write to Supabase cmrai_registry
 *   4. Send Resend confirmation email
 *   5. Send Photon message
 *   6. Return HOC + CMID data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      human_name,
      home_address,
      web3_address,
      email          = '',
      ip,
      device_info,
      face_match_score,
      liveness_score,
      witness_hash,
      scroll_tx_hash,
      video_cid,
      ipfs_hash,
      constitutional_statement_hash,
      channel        = 'email',
      channel_handle = '',
    } = body

    if (!human_name)   return NextResponse.json({ error: 'human_name required' },  { status: 400 })
    if (!witness_hash) return NextResponse.json({ error: 'witness_hash required' }, { status: 400 })

    // ── 1. Issue HOC via MMCP ────────────────────────────────────
    const hocRes = await fetch(`${MMCP_BASE}/mmcp/hoc`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        human_name,
        cmid_token:        witness_hash,  // use witness_hash as initial cmid_token
        ipfs_manifest_cid: ipfs_hash || video_cid || '',
      }),
    })

    const hocData = await hocRes.json()
    if (!hocRes.ok) {
      console.error('[verify] HOC issuance failed:', hocData)
      return NextResponse.json({ error: hocData.error || 'HOC issuance failed' }, { status: hocRes.status })
    }

    const hoc_id            = hocData.hoc_id            as string
    const human_aio_id      = hocData.aio_id            as string
    const genesis_session_id = hocData.genesis_session_id as string

    // ── 2. Mint CMID on XRPL (best-effort) ──────────────────────
    let cmid = ''
    try {
      const cmidRes = await fetch(`${req.nextUrl.origin}/api/cmid/mint`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: hoc_id,
          session_id:    genesis_session_id,
        }),
      })
      if (cmidRes.ok) {
        const cmidData = await cmidRes.json()
        cmid = cmidData.cmid_token || cmidData.token || ''
      }
    } catch (err) {
      console.warn('[verify] CMID mint failed (non-fatal):', err)
    }

    // ── 3. Write to Supabase cmrai_registry ──────────────────────
    const registryRecord = {
      owner_hoc_id:    hoc_id,
      human_aio_id,
      cmid:            cmid || '',
      witness_hash,
      scroll_tx_hash:  scroll_tx_hash || '',
      ipfs_hash:       ipfs_hash      || video_cid || '',
      video_cid:       video_cid      || '',
      email:           email          || '',
      ip:              ip             || '',
      device_info:     device_info    || '',
      web3_address:    web3_address   || '',
      home_address:    home_address   || '',
      face_match_score: Number(face_match_score) || 0,
      liveness_score:   Number(liveness_score)   || 0,
      status:          'verified',
      verified_at:     new Date().toISOString(),
    }

    const { error: dbErr } = await getSupabase().from('cmrai_registry').insert(registryRecord)
    if (dbErr) {
      console.warn('[verify] Supabase write failed (non-fatal):', dbErr.message)
    }

    // ── 4. Send Resend email ─────────────────────────────────────
    const scrollscanUrl = scroll_tx_hash
      ? `https://sepolia.scrollscan.com/tx/${scroll_tx_hash}`
      : ''

    try {
      await getResend().emails.send({
        from:    FROM_EMAIL,
        to:      [email || TO_EMAIL],
        subject: `Your ChainMail identity is registered — HOC ${hoc_id}`,
        html: `
          <div style="font-family: monospace; background: #0f172a; color: #f1f5f9; padding: 32px; border-radius: 12px; max-width: 600px;">
            <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">ChainMail Global</div>
            <h1 style="font-size: 22px; margin: 0 0 8px; color: #fff;">Your identity is witnessed and registered.</h1>
            <p style="color: #94a3b8; margin: 0 0 32px;">Welcome to the agentic economy, ${human_name}.</p>

            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0 2px;">HOC ID</td>
              </tr>
              <tr>
                <td style="color: #4ade80; font-family: monospace; padding-bottom: 16px; word-break: break-all;">${hoc_id}</td>
              </tr>
              ${cmid ? `
              <tr>
                <td style="color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0 2px;">CMID (XRPL)</td>
              </tr>
              <tr>
                <td style="color: #60a5fa; font-family: monospace; padding-bottom: 16px; word-break: break-all;">${cmid}</td>
              </tr>` : ''}
              <tr>
                <td style="color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0 2px;">Witness Hash</td>
              </tr>
              <tr>
                <td style="color: #e2e8f0; font-family: monospace; padding-bottom: 16px; word-break: break-all; font-size: 12px;">${witness_hash}</td>
              </tr>
              ${scroll_tx_hash ? `
              <tr>
                <td style="color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0 2px;">Scroll Anchor TX</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px;">
                  <a href="${scrollscanUrl}" style="color: #60a5fa; font-family: monospace; font-size: 12px; word-break: break-all;">${scroll_tx_hash}</a>
                </td>
              </tr>` : ''}
              ${ipfs_hash ? `
              <tr>
                <td style="color: #64748b; font-size: 11px; text-transform: uppercase; padding: 8px 0 2px;">IPFS Evidence</td>
              </tr>
              <tr>
                <td style="padding-bottom: 16px;">
                  <a href="https://gateway.pinata.cloud/ipfs/${ipfs_hash}" style="color: #60a5fa; font-family: monospace; font-size: 12px;">${ipfs_hash}</a>
                </td>
              </tr>` : ''}
            </table>

            ${scrollscanUrl ? `
            <a href="${scrollscanUrl}" style="display: inline-block; margin-top: 16px; background: #1d4ed8; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: bold;">
              Verify on ScrollScan →
            </a>` : ''}

            <p style="color: #475569; font-size: 12px; margin-top: 32px; border-top: 1px solid #1e293b; padding-top: 16px;">
              All AI agents registered under your identity trace back to you.<br/>
              This is your constitutional anchor in the agentic economy.
            </p>
          </div>
        `,
      })
    } catch (err) {
      console.warn('[verify] Resend email failed (non-fatal):', err)
    }

    // ── 5. Channel notification (chosen by user in step 0) ───────
    const photonMessage = [
      `Your identity is witnessed and registered.`,
      ``,
      `CMID: ${cmid || '(minting)'}`,
      `HOC: ${hoc_id}`,
      `Witness: ${witness_hash.slice(0, 16)}…`,
      scroll_tx_hash ? `Verify: https://sepolia.scrollscan.com/tx/${scroll_tx_hash}` : '',
      ``,
      `Welcome to the agentic economy.`,
    ].filter(Boolean).join('\n')

    // Dispatch to user's chosen channel via /api/notify
    try {
      await fetch(`${req.nextUrl.origin}/api/notify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          channel_handle,
          message:       photonMessage,
          hoc_id,
          cmid,
          witness_hash,
          scroll_tx_hash,
        }),
      })
    } catch (err) {
      console.warn('[verify] Channel notify failed (non-fatal):', err)
    }

    // ── 6. Return ─────────────────────────────────────────────────
    return NextResponse.json({
      hoc_id,
      aio_id:             human_aio_id,
      genesis_session_id,
      cmid:               cmid || '',
      witness_hash,
      scroll_tx_hash:     scroll_tx_hash || '',
      ipfs_hash:          ipfs_hash      || '',
      video_cid:          video_cid      || '',
      photon_message:     photonMessage,
      redirect:           'https://openclaw.chainmail.global',
    })
  } catch (err: any) {
    console.error('[verify] Fatal error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
