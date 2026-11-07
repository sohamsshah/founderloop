# Founder Loop environment setup

Updated 7 November 2026, 12:00 IST. The Product live gate will use the Switch Console-managed local server because it already displays the Slack and Discord connections. The standalone Docker server hosts an earlier custom-agent registration, but its agent and keys cannot access Console-server rooms.

## Already configured and checked

- This folder is an independent Git repository. The local `.env`, `.switch/`, `secrets/`, `data/`, and `node_modules/` are ignored.
- Node.js 22 and Docker Compose are available. An isolated `founderloop-switch` Compose project runs Switch 0.31.0 with its API at `http://127.0.0.1:18000` and Gateway at `http://127.0.0.1:13000`, both on loopback. Health checks returned HTTP 200.
- The `founder-loop` custom agent was registered on that server. Its private ID and API key are in the ignored `.env`; its registration key remains in the ignored `.switch/standalone/` area. Authenticated agent operations and a passive WebSocket handshake passed. The socket reported zero rooms, so no live message delivery was proven.
- Direct Slack bot and app-token authentication passed. Discord bot identity passed, while the guild check returned Discord code `40333` and remains unverified. These direct checks do not establish Switch bridge connectivity.
- The user-provided Google Doc was populated as a clearly labeled demo reference. A public text export read and exact excerpt match passed. This does not prove private Google Docs OAuth API access. No Leads Sheet is configured.
- The direct bot APIs can list the configured Slack workspace and Discord server channels. Dedicated private Slack founder/Product/Sales/Support channels and a Discord source channel were created. The user identified `@sohamshah456` as their Slack account and was invited to all four private channels. Their native channel IDs and Slack user ID are in ignored `.env`. These are not Switch room IDs.

## Finish the Product live setup

1. Create a user-owned registration key on the Console-managed server and register the external `founder-loop` agent there. Verify its agent API key and passive socket against `http://127.0.0.1:55571`. Keep the old standalone server separate; do not attach duplicate bot-token consumers.
2. Verify the existing Slack and Discord connections are healthy. Map the dedicated Discord source and private Slack founder/Product channels to Switch rooms, and invite the new custom agent. Record the real Switch IDs in ignored `.env` using [`.env.example`](../.env.example). Set `SWITCH_SOURCE_ROOM_ID`, `SWITCH_FOUNDER_ROOM_ID`, and `SWITCH_PRODUCT_ROOM_ID`. Sales/Support rooms are unnecessary for the Product-only gate; do not use native channel IDs as Switch room IDs.
3. Observe a founder-authored message in the mapped founder room. Verify its trusted Switch sender ID and set `FOUNDER_SWITCH_SENDER_ID`; if a native Slack sender ID is exposed, set `FOUNDER_SLACK_USER_ID` too. A display name is insufficient. Record the agent sender ID for echo exclusion.
4. Send one ordinary, unmentioned Discord test message. Observe the passive `scope=all`, `filter=all` event, including its native guild, channel, and message IDs or a trusted exact-message URL. Check that no bot reply, reaction, or typing indicator appears. If Switch omits native IDs, the app marks the candidate `EVIDENCE_BLOCKED`; do not manufacture a link from a Switch ID.
5. Open a real card's individual source-message link as the founder. Compare its quote to the original, use one real founder decision, confirm exactly one Product Slack verdict, and observe CLOSED. Record sanitized evidence in [Switch integration](SWITCH_INTEGRATION.md) and [status](STATUS.md). Only then consider Gate A live and shippable.
6. For Product Doc access, the current `.env` can read the named public demo Doc with `GOOGLE_DOC_PUBLIC_EXPORT=true`. For a private one-Doc API read, configure `GOOGLE_ACCESS_TOKEN` or a service-account JSON path under ignored `secrets/`, and share that Doc with the API identity. This path needs a live probe.
7. For Revenue, create one named Google Sheet with the `Leads` tab and columns in [Google integration](GOOGLE_INTEGRATION.md). Set `GOOGLE_REVENUE_SHEET_ID`; authorize the API identity. Enable `ENABLE_SHEET_WRITE=true` only after Editor access and an accepted-write test. Revenue and Commitment live signoff follow Gate A, in that order.

Run `npm test`, `npm run demo:product`, and `npm run demo` for offline verification. Use `node --env-file=.env scripts/probe-switch.js` and `node --env-file=.env scripts/probe-google.js` for the narrow integration probes. `npm run live` starts the passive agent only after room and identity mappings are complete.

No secret values, live source-message IDs, or unverified permalink claims belong in committed docs or screenshots.
