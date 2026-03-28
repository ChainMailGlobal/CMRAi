import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MMCP_BASE = process.env.MMCP_API_BASE_URL || 'http://localhost:5000'
const PINATA_API_KEY    = process.env.PINATA_API_KEY    || ''
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || ''

/**
 * POST /api/witness
 *
 * Bridge between the CMRAi verification UI and the MMCP /mmcp/witness endpoint.
 *
 * Accepts multipart/form-data with fields:
 *   face_match_score, liveness_score, signature_hash, timestamp,
 *   ip, device_info, web3_address, home_address, human_name,
 *   constitutional_statement_hash
 *   video  (optional .webm file)
 *
 * Uploads video to IPFS via Pinata (if present), then POSTs all data
 * to MMCP /mmcp/witness and returns the witness result.
 *
 * Returns:
 *   { witness_hash, tx_hash, block_number, anchor_id, video_cid, ipfs_hash }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const face_match_score              = String(formData.get('face_match_score') ?? '0')
    const liveness_score                = String(formData.get('liveness_score')   ?? '0')
    const signature_hash                = String(formData.get('signature_hash')   ?? '')
    const timestamp                     = String(formData.get('timestamp')        ?? new Date().toISOString())
    const ip                            = String(formData.get('ip')               ?? '')
    const device_info                   = String(formData.get('device_info')      ?? '')
    const web3_address                  = String(formData.get('web3_address')     ?? '')
    const home_address                  = String(formData.get('home_address')     ?? '')
    const human_name                    = String(formData.get('human_name')       ?? '')
    const constitutional_statement_hash = String(formData.get('constitutional_statement_hash') ?? '')
    const videoFile = formData.get('video') as File | null

    // ── Upload video to IPFS if present ──────────────────────────
    let video_cid = ''
    if (videoFile && videoFile.size > 0 && PINATA_API_KEY && PINATA_SECRET_KEY) {
      try {
        const pinataForm = new FormData()
        pinataForm.append('file', videoFile, videoFile.name || 'constitutional_statement.webm')
        pinataForm.append(
          'pinataMetadata',
          JSON.stringify({ name: `cmrai-witness-${human_name}-${Date.now()}` })
        )

        const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            pinata_api_key:        PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_KEY,
          },
          body: pinataForm,
        })

        if (pinataRes.ok) {
          const pinataData = await pinataRes.json()
          video_cid = pinataData.IpfsHash || ''
        } else {
          console.warn('[witness] Pinata upload failed:', await pinataRes.text())
        }
      } catch (err) {
        console.warn('[witness] Pinata error:', err)
      }
    }

    // ── Forward to MMCP /mmcp/witness ─────────────────────────────
    const mmcpForm = new FormData()
    mmcpForm.append('face_match_score',              face_match_score)
    mmcpForm.append('liveness_score',                liveness_score)
    mmcpForm.append('signature_hash',                signature_hash)
    mmcpForm.append('timestamp',                     timestamp)
    mmcpForm.append('ip',                            ip)
    mmcpForm.append('device_info',                   device_info)
    mmcpForm.append('web3_address',                  web3_address)
    mmcpForm.append('home_address',                  home_address)
    mmcpForm.append('human_name',                    human_name)
    mmcpForm.append('constitutional_statement_hash', constitutional_statement_hash)
    // Pass video_cid so MMCP can include it in the witness hash (video already uploaded)
    if (video_cid) mmcpForm.append('video_cid', video_cid)

    const mmcpRes = await fetch(`${MMCP_BASE}/mmcp/witness`, {
      method: 'POST',
      body:   mmcpForm,
    })

    const mmcpData = await mmcpRes.json()

    if (!mmcpRes.ok) {
      console.error('[witness] MMCP error:', mmcpData)
      return NextResponse.json(
        { error: mmcpData.error || 'MMCP witness failed' },
        { status: mmcpRes.status }
      )
    }

    return NextResponse.json({
      ...mmcpData,
      video_cid,
      ipfs_hash: video_cid,
    })
  } catch (err: any) {
    console.error('[witness] Unexpected error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
