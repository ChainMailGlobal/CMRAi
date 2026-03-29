# CMRAi — ChainMail Registered Agent

> **49,400+ agents registered on ERC-8004. Zero verified human binding. Until now.**

Constitutional identity registry for AI agents. CMRAi is the enrollment system that binds every AI agent to a verified human — anchored on XRPL and Scroll L2. No anonymous agents. No unaccountable AI.

**NIST AI Risk Management Framework compliant by design.** Every agent action traces back to a live-video-verified human via cryptographic HOC (Human Origin Confirmation).

## What it does

- Verifies human identity via live video (face-api.js liveness + ID match)
- Reads constitutional oath aloud via ElevenLabs AI Witness voice
- Records oath on camera and uploads evidence to IPFS
- Issues Human Origin Confirmation (HOC) via MMCP
- Mints CMID on XRPL — your on-chain human identity token
- Anchors genesis session on Scroll L2 — permanent, tamper-proof
- Registers all AI agents spawned under your identity
- Guards agent spawns constitutionally — every action traces back to a human
- Delivers confirmation via your chosen channel: iMessage, Telegram, Discord, WhatsApp, Android SMS, or Email

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| Human identity | XRPL (CMID NFT) |
| Audit anchoring | Scroll L2 (Sepolia testnet → mainnet) |
| Constitutional runtime | MMCP (ChainMail) |
| Voice guidance | ElevenLabs Conversational AI |
| Video evidence | Pinata / IPFS |
| Registry | Supabase |
| Email confirmation | Resend |
| Multi-channel delivery | Telegram, Discord, WhatsApp, SMS, iMessage |
| Face verification | MMCP (Nebius vision) |

## Live Demo

[cmrai.chainmail.global](https://cmrai.chainmail.global)

## Part of ChainMail Global

CMRAi is the identity layer of [MMCP](https://github.com/ChainMailGlobal/mmcp) — the constitutional runtime for the agentic economy.

Every AI agent in the ChainMail ecosystem carries a CMID that traces back to a verified human HOC. No anonymous agents. No unaccountable AI.

[chainmail.global](https://chainmail.global)

## Setup

```bash
# 1. Clone
git clone https://github.com/ChainMailGlobal/cmrai.git
cd cmrai/apps/web

# 2. Install
npm install

# 3. Configure
cp .env.example .env.local
# Fill in your keys (see .env.example for required values)

# 4. Run MMCP backend (separate repo)
# github.com/ChainMailGlobal/mmcp
cd /path/to/mmcp && python main.py

# 5. Run CMRAi
npm run dev
# Open http://localhost:3000/verify
```

## Verification Flow

```
Step 0  Pick your confirmation channel (Telegram, Discord, WhatsApp, etc.)
Step 1  Live video + ID capture — liveness check + face match
Step 2  Signature capture
Step 3  Enter details (name, address, email, web3 wallet)
Step 4  Constitutional oath — read aloud by AI Witness, repeated on camera
Step 5  MMCP witnesses the session → Scroll anchor transaction fires
Step 6  HOC issued + CMID minted → confirmation delivered to your channel
```

## Required Services

| Service | Purpose | Get it |
|---|---|---|
| Supabase | Registry database | [supabase.com](https://supabase.com) |
| ElevenLabs | AI Witness voice | [elevenlabs.io](https://elevenlabs.io) |
| Resend | Email confirmation | [resend.com](https://resend.com) |
| Pinata | IPFS video storage | [pinata.cloud](https://pinata.cloud) |
| Scroll Sepolia | Blockchain anchor | [scroll.io](https://scroll.io) |
| XRPL | CMID identity token | [xrpl.org](https://xrpl.org) |
| Telegram Bot | Channel delivery | [t.me/BotFather](https://t.me/BotFather) |
| Discord Bot | Channel delivery | [discord.dev](https://discord.com/developers) |
| Twilio | Android SMS | [twilio.com](https://twilio.com) |
| Photon | iMessage relay | [photon.codes](https://photon.codes) |
| WhatsApp Cloud API | WhatsApp delivery | [Meta for Developers](https://developers.facebook.com) |

## License

MIT — ChainMail Global 2026
