# Switch integration evidence

## Local topology

Two distinct Switch servers exist on this machine. The original Console-managed server already has Slack, Discord, and Google Workspace connections, but does **not** host this custom agent. The official Switch 0.31.0 standalone Docker Compose deployment hosts the `founder-loop` custom agent and Gateway. Its API is `http://127.0.0.1:18000`, and Gateway is `http://127.0.0.1:13000`. Its messaging bridges and rooms have **not** been configured. Agent and registration secrets are in ignored local files.

For the Product live gate, the Console-managed server is now the chosen authority. Switch Console 0.40.1 showed it running Switch 0.31.0 with Slack and Discord messaging connections and 13 existing rooms; its loopback API at `http://127.0.0.1:55571/health` returned HTTP 200. Those visible connections still need an event/room test. The standalone agent credentials cannot authenticate to this server. The external agent must be registered there using a user-owned registration key, as described in [Switch agent registration](https://docs.switchagents.ai/switch-rooms/administer/people-and-agents#register-an-agent-that-runs-outside-switch-console). The user authorized that creation, but the key and new agent have not yet been observed, so no Console-server agent access is claimed.

## Observed, 7 November 2026

- Standalone API `/health` and Gateway returned HTTP 200; authenticated `GET /agents/{id}/ops` succeeded.
- `node --env-file=.env scripts/probe-switch.js` opened the documented bearer-authenticated `/agents/{id}/connection/ws` socket. The actual control frame was `{event:"connection_state",data:{...}}`, with `filter=all`, `scope=all`, and **zero rooms**. A later `{event:"ping",data:{...}}` was answered with an application-level `pong`. The client now reads control fields from `data`.
- No unmentioned Discord source event, mapped Slack card, internal Slack verdict, or source-channel silence has been observed. The WebSocket probe is authentication and protocol evidence only.
- Slack bot `auth.test` and app token `apps.connections.open` passed against Slack; returned team ID matched the configured workspace ID. Discord bot `/users/@me` passed. Discord `/guilds/{id}` returned HTTP 403 and Discord code `40333` (`internal network error`), so guild access remains unverified. These are direct API credential checks, not Switch bridge evidence.
- A later direct Discord guild-channel listing succeeded. Direct APIs created dedicated channels: Slack private `#founder-loop-founder` (`C0CGKFW5GHW`), `#founder-loop-product` (`C0CFKRZE20M`), `#founder-loop-sales` (`C0CFJTV1MJP`), and `#founder-loop-support` (`C0CFP66TUG6`); Discord `#founder-loop-source` (`1568492126587715695`). The user identified Slack account `@sohamshah456` (`U0CF14CL2CR`), and the bot successfully invited it to all four private channels. Native IDs are recorded in ignored `.env`. No Switch room mapping or message delivery is implied by this check.

## Documentation contract implemented

- [Switch agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection): bearer header, persistent `connection_id`, claimed rooms, `scope=all`, `filter=all`, cursor resume, `expected_generation`, and application-level ping/pong. The former SSE path is deprecated and is no longer used by this app.
- [Switch agent events](https://docs.switchagents.ai/switch-rooms/internals/agent-events): generic message envelope contains Switch sender, message ID, text, timestamp, and addressed flag. It does not guarantee native Discord guild/channel/message IDs or native Slack channel/`ts`.
- [Switch agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol): `POST /agents/{id}/message` accepts `{room_id,content}`. `src/transport.js` posts only to configured founder/internal rooms.
- [Slack `chat.getPermalink`](https://docs.slack.dev/reference/methods/chat.getPermalink/): requires the original Slack channel ID and message `ts`, including the thread reply `ts` when the source is a reply. The app never substitutes a Switch room ID.

## Exact citation gate

For Discord, `src/evidence.js` constructs an individual-message URL only from three trusted numeric native IDs. For Slack, it asks Slack for a permalink using the native channel ID and original `ts`. A generic Switch `message_id`, channel name, wall-clock timestamp, or room ID is never treated as a native ID. Missing evidence creates an `EVIDENCE_BLOCKED` record and no actionable founder card. `fixture://` links are visibly simulated.

Even a correctly formed link may be inaccessible to the founder. A live Gate A signoff requires a founder account to click one actual source link and verify the individual message, exact quote, author, channel, and time.

## Live setup and test still required

1. Check the Discord bot is invited to the supplied server and has the permissions and intents in [Switch's Discord setup guide](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/discord). Connect it to the **standalone** Switch server.
2. Connect the Slack app to the standalone server using the bot token, app-level token, and workspace ID in ignored `.env`, following [Switch's Slack setup guide](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/slack).
3. Map the source channel and private founder/Product/Sales/Support Slack channels to Switch rooms, add the custom agent, and record their Switch room IDs in `.env`. Verify `FOUNDER_SWITCH_SENDER_ID` from an actual founder message and optionally `FOUNDER_SLACK_USER_ID` from trusted native metadata.
4. Send an ordinary unmentioned Discord message. Capture only a **sanitized** event shape, note its native ID fields, confirm no source-channel reply/reaction/typing, and test a founder-accessible exact-message permalink.
5. Observe a real founder card, one authenticated decision, one correctly routed internal Slack notification, and CLOSED. Repeat/replay to check duplicates.

Do not put agent keys, bot tokens, raw private messages, or private document content in this evidence file.
