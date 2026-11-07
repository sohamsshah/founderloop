# Founder Loop environment setup

Updated 7 November 2026, 10:24 IST. This guide reflects the separate standalone Switch server used by this repository. The older Switch Console managed server has existing Slack, Discord, and Google connections, but those connections do not automatically appear on this standalone server.

## Already configured and checked

- This folder is an independent Git repository. The local `.env`, `.switch/`, `secrets/`, `data/`, and `node_modules/` are ignored.
- Node.js 22 and Docker Compose are available. An isolated `founderloop-switch` Compose project runs Switch 0.31.0 with its API at `http://127.0.0.1:18000` and Gateway at `http://127.0.0.1:13000`, both on loopback. Health checks returned HTTP 200.
- The `founder-loop` custom agent was registered on that server. Its private ID and API key are in the ignored `.env`; its registration key remains in the ignored `.switch/standalone/` area. Authenticated agent operations and a passive WebSocket handshake passed. The socket reported zero rooms, so no live message delivery was proven.
- Direct Slack bot and app-token authentication passed. Discord bot identity passed, while the guild check returned Discord code `40333` and remains unverified. These direct checks do not establish Switch bridge connectivity.
- The user-provided Google Doc was populated as a clearly labeled demo reference. A public text export read and exact excerpt match passed. This does not prove private Google Docs OAuth API access. No Leads Sheet is configured.

## Finish the isolated live setup

1. Connect Slack and Discord bridges to the **standalone** Switch server. Create an authorized Discord test source channel and private Slack founder, Product, Sales, and Support channels. Map them to Switch rooms and invite the custom agent. Leave the older Console-managed workflows alone.
2. Record the room IDs in ignored `.env` using [`.env.example`](../.env.example). Set `SWITCH_SOURCE_ROOM_ID` or `SWITCH_SOURCE_ROOM_IDS`, `SWITCH_FOUNDER_ROOM_ID`, and the three internal destination IDs. Do not use room names as IDs.
3. Observe a founder-authored message in the mapped founder room. Verify its trusted Switch sender ID and set `FOUNDER_SWITCH_SENDER_ID`; if a native Slack sender ID is exposed, set `FOUNDER_SLACK_USER_ID` too. A display name is insufficient. Record the agent sender ID for echo exclusion.
4. Send one ordinary, unmentioned Discord test message. Observe the passive `scope=all`, `filter=all` event, including its native guild, channel, and message IDs or a trusted exact-message URL. Check that no bot reply, reaction, or typing indicator appears. If Switch omits native IDs, the app marks the candidate `EVIDENCE_BLOCKED`; do not manufacture a link from a Switch ID.
5. Open a real card's individual source-message link as the founder. Compare its quote to the original, use one real founder decision, confirm exactly one Product Slack verdict, and observe CLOSED. Record sanitized evidence in [Switch integration](SWITCH_INTEGRATION.md) and [status](STATUS.md). Only then consider Gate A live and shippable.
6. For Product Doc access, the current `.env` can read the named public demo Doc with `GOOGLE_DOC_PUBLIC_EXPORT=true`. For a private one-Doc API read, configure `GOOGLE_ACCESS_TOKEN` or a service-account JSON path under ignored `secrets/`, and share that Doc with the API identity. This path needs a live probe.
7. For Revenue, create one named Google Sheet with the `Leads` tab and columns in [Google integration](GOOGLE_INTEGRATION.md). Set `GOOGLE_REVENUE_SHEET_ID`; authorize the API identity. Enable `ENABLE_SHEET_WRITE=true` only after Editor access and an accepted-write test. Revenue and Commitment live signoff follow Gate A, in that order.

Run `npm test`, `npm run demo:product`, and `npm run demo` for offline verification. Use `node --env-file=.env scripts/probe-switch.js` and `node --env-file=.env scripts/probe-google.js` for the narrow integration probes. `npm run live` starts the passive agent only after room and identity mappings are complete.

No secret values, live source-message IDs, or unverified permalink claims belong in committed docs or screenshots.
