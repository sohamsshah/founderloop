# Submission draft — Founder Loop

**Title:** Founder Loop: source-cited founder decisions from community conversations

**Description:** Founder Loop is a single-process Switch custom agent that silently listens to authorized Discord or Slack rooms, preserves each original message, and requires an exact-message citation before offering a founder decision. Product signals consult one named Google Doc, Revenue signals consult one Leads Sheet, and Commitment signals identify an issue or explicit promise without tracking work. An authenticated founder chooses ACCEPT, REJECT, or COMMENT; one sourced verdict goes to the corresponding internal Slack room, and the record closes.

**Stack:** Node.js 22 ES modules, SQLite, Switch WebSocket custom-agent protocol and HTTP post operation, Slack `chat.getPermalink`, Google Docs and Sheets adapters, local candidate filtering with optional structured model classification, no standalone UI.

**Reproducible local demo:** `npm ci && npm test && npm run demo:product && npm run demo`. These commands are explicitly **SIMULATED** fixture replays. Automated tests currently pass 43/43. The separate live Product flow was also verified on the local standalone Switch server.

**Actual live integration evidence:** a fresh unmentioned Discord Product request reached the standalone Switch agent, which covered the source and founder rooms with `filter=all`. Discord's bot API resolved one exact original message after Switch omitted native IDs. A private Slack founder message appeared once with the verbatim quote, individual Discord link, and named demo Google Doc context. The founder opened that source link and sent a COMMENT command from the verified Slack account. Product Slack received one matching verdict with the same source link; SQLite recorded one immutable decision and `CLOSED` after both outbound acknowledgements. Direct Discord inspection found no bot reply or reaction. The Doc read mode was `public_export`, not OAuth Docs API.

**Interactive card checkpoint:** the dedicated Slack app's Socket Mode listener connected beside the Switch bridge. Fresh unmentioned Discord requests produced `FL-005` and `FL-006`. A live Accept button click closed `FL-005` with one Product verdict. The Comment button opened a multiline modal for `FL-006`; its submission recorded one COMMENT decision, sent one Product verdict, and closed the card. Both founder and Product outbox entries were acknowledged once for each card. The earlier `FL-004` Block Kit layout and REJECT text-command test remain separate evidence. Reject button delivery has not been clicked live.

**Closed card state:** after Product delivery, the founder message is updated to remove buttons and show “🎉 Decision made. Loop closed.” Existing closed interactive cards `FL-005`–`FL-007` were updated through Slack `chat.update`. A fresh `FL-008` Accept action then closed automatically; direct Slack history confirmed the founder card has a completion section and no actions block, and the Product channel has one `FL-008` verdict. SQLite has one decision and two acknowledged outbound entries. `FL-007` was an additional Accept decision, and its Product verdict was verified directly in the private Product channel. The founder chose to skip a live Reject button test.

**Support intake in progress:** `#founder-loop-support` is a Switch room with the registered agent and is mapped as a Slack source for Commitment issues and explicit promises only. A read-only live probe resolved an existing human post to its exact Slack permalink. A fresh qualifying human post and founder decision have not yet been observed, so the live Commitment journey remains unverified.

**Unverified or limited:** live Reject button click, private Google Docs OAuth API read, real company roadmap content, Leads Sheet read/write, live Revenue/Commitment journeys, retrospective typing indicator, and always-on deployment. The agent runs in a local Docker container, not on a deployed host. The published generic Switch event omitted native source IDs in this test; the bot API resolves only a unique exact match and otherwise blocks uncited cards with `EVIDENCE_BLOCKED`.

**Demo link/video:** none captured yet. Add only a real artifact.

Present Gate A as a verified local technical Product journey with demo Doc context. Do not claim live Revenue or Commitment, private Docs API access, or always-on hosting. See [`STATUS.md`](STATUS.md).
