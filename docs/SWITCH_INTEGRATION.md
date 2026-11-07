# Switch integration evidence

## Local topology

Two distinct Switch servers exist on this machine. The original Console-managed server did not host this custom agent. With founder approval, its process was stopped before reusing its Slack/Discord bot credentials. The official Switch 0.31.0 standalone Docker Compose deployment hosts the `founder-loop` custom agent, active Slack/Discord bridges, and three Product rooms. Its API is `http://127.0.0.1:18000`, and Gateway is `http://127.0.0.1:13000`. Agent and registration secrets are in ignored local files. Do not restart the Console-managed server while standalone uses the same tokens.

For the Product live gate, use the standalone server after a coordinated bridge handoff. Switch Console 0.40.1's built-in server runs Switch 0.31.0 with Slack and Discord connections and 13 existing rooms, but the API root requires bearer auth, its `/gateway/` returned 404, and the user reports no **Full admin interface** button. The standalone Gateway root returned HTTP 200 and its existing `founder-loop` agent authenticated over WebSocket. [Context Keeper's implementation notes](https://github.com/thekashifnazir/context-keeper/blob/main/JUDGES.md#why-we-run-our-own-switch-server) describe the same Console registration-key limitation and use Switch's published Docker server with Gateway. Do not run the same Slack/Discord tokens on both servers concurrently.

## Observed, 7 November 2026

- Standalone API `/health` and Gateway returned HTTP 200; authenticated `GET /agents/{id}/ops` succeeded.
- The initial `scripts/probe-switch.js` socket authenticated with zero rooms because it did not claim any. The live agent claims its source and founder rooms at open; `connection_state` reported two covered rooms with `filter=all`. A separate explicit-claim probe covered all three mapped rooms. Application-level ping/pong worked.
- A fresh unmentioned Discord Product event reached the agent and produced `FL-003` in private founder Slack. The founder opened the individual-message link and sent a COMMENT command; one Product Slack verdict followed and SQLite marked `CLOSED`. Direct Discord API inspection found no bot reply or reaction near the source post. This is live local technical proof using the named demo Doc's public text export, not private Docs OAuth API proof.
- Slack bot `auth.test` and app token `apps.connections.open` passed against Slack; returned team ID matched the configured workspace ID. Discord bot `/users/@me` passed. Discord `/guilds/{id}` returned HTTP 403 and Discord code `40333` (`internal network error`), so guild access remains unverified. These are direct API credential checks, not Switch bridge evidence.
- A later direct Discord guild-channel listing succeeded. Direct APIs created dedicated channels: Slack private `#founder-loop-founder` (`C0CGKFW5GHW`), `#founder-loop-product` (`C0CFKRZE20M`), `#founder-loop-sales` (`C0CFJTV1MJP`), and `#founder-loop-support` (`C0CFP66TUG6`); Discord `#founder-loop-source` (`1568492126587715695`). The user identified Slack account `@sohamshah456` (`U0CF14CL2CR`), and the bot successfully invited it to all four private channels. Native IDs are recorded in ignored `.env`. No Switch room mapping or message delivery is implied by this check.

## Documentation contract implemented

- [Switch agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection): bearer header, persistent `connection_id`, claimed rooms, `scope=all`, `filter=all`, cursor resume, `expected_generation`, and application-level ping/pong. The former SSE path is deprecated and is no longer used by this app.
- [Switch agent events](https://docs.switchagents.ai/switch-rooms/internals/agent-events): generic message envelope contains Switch sender, message ID, text, timestamp, and addressed flag. It does not guarantee native Discord guild/channel/message IDs or native Slack channel/`ts`.
- [Switch agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol): `POST /agents/{id}/message` accepts `{room_id,content}`. `src/transport.js` posts only to configured founder/internal rooms.
- [Slack `chat.getPermalink`](https://docs.slack.dev/reference/methods/chat.getPermalink/): requires the original Slack channel ID and message `ts`, including the thread reply `ts` when the source is a reply. The app never substitutes a Switch room ID.

## Exact citation gate

For Discord, the observed Switch event had `sender`, `sender_name`, `message_id`, `body`, `timestamp`, and `addressed`, but no native guild/channel/message IDs or `platform_sender_id`. `src/evidence.js` therefore queries the configured Discord channel through the bot API, verifies that channel's guild, and accepts only one recent message with the exact text, matching author name, numeric native IDs, and timestamp within 10 seconds. It then constructs an individual-message URL from those native IDs. The first live event correctly produced `EVIDENCE_BLOCKED` before this resolver existed. For Slack sources, the app asks Slack for a permalink using the original native channel ID and `ts`. A generic Switch `message_id`, channel name, wall-clock timestamp, or room ID is never treated as a native ID. Missing or ambiguous evidence still creates `EVIDENCE_BLOCKED` and no actionable founder message. `fixture://` links are visibly simulated.

Even a correctly formed link may be inaccessible to the founder. A live Gate A signoff requires a founder account to click one actual source link and verify the individual message, exact quote, author, channel, and time.

## Live setup and verification

1. Check the Discord bot is invited to the supplied server and has the permissions and intents in [Switch's Discord setup guide](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord). Connect it to the **standalone** Switch server.
2. Connect the Slack app to the standalone server using the bot token, app-level token, and workspace ID in ignored `.env`, following [Switch's Slack setup guide](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/slack).
3. Map the source channel and private founder/Product/Sales/Support Slack channels to Switch rooms, add the custom agent, and record their Switch room IDs in `.env`. Verify `FOUNDER_SWITCH_SENDER_ID` from an actual founder message and optionally `FOUNDER_SLACK_USER_ID` from trusted native metadata.
4. Send an ordinary unmentioned Discord message. Capture only a **sanitized** event shape, note its native ID fields, confirm no source-channel reply/reaction/typing, and test a founder-accessible exact-message permalink.
5. Observe a real founder card, one authenticated decision, one correctly routed internal Slack notification, and CLOSED. Repeat/replay to check duplicates.

Do not put agent keys, bot tokens, raw private messages, or private document content in this evidence file.
