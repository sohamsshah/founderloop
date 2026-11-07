# Submission draft — Founder Loop

**Title:** Founder Loop: source-cited founder decisions from community conversations

**Description:** Founder Loop is a single-process Switch custom agent that silently listens to authorized Discord or Slack rooms, preserves each original message, and requires an exact-message citation before offering a founder decision. Product signals consult one named Google Doc, Revenue signals consult one Leads Sheet, and Commitment signals identify an issue or explicit promise without tracking work. An authenticated founder chooses ACCEPT, REJECT, or COMMENT; one sourced verdict goes to the corresponding internal Slack room, and the record closes.

**Stack:** Node.js 22 ES modules, SQLite, Switch WebSocket custom-agent protocol and HTTP post operation, Slack `chat.getPermalink`, Google Docs and Sheets adapters, local candidate filtering with optional structured model classification, no standalone UI.

**Reproducible current demo:** `npm ci && npm test && npm run demo:product && npm run demo`. The demos are explicitly **SIMULATED** and use fixture provenance markers. Automated tests currently pass 28/28.

**Actual live integration evidence:** local standalone Switch agent authenticated over WebSocket with `filter=all`, received `connection_state` and `ping`, and sent `pong` while covering zero rooms. Direct Slack bot/app token authentication passed; Discord bot authentication passed, but guild access remains unverified. The user-provided, clearly labeled demo Google Doc was read as a public text export and matched against an exact excerpt. This is not an OAuth Docs API read.

**Unverified:** passive Discord → Switch capture and source silence, native source IDs, founder-accessible individual-message permalink, live Slack founder/Internal posts, Google OAuth Docs read, Leads Sheet read/write, and live Revenue/Commitment journeys. The published generic Switch event does not guarantee native source IDs, so the app blocks uncited live cards with `EVIDENCE_BLOCKED`.

**Demo link/video:** none captured yet. Add only a real artifact.

Do not submit a claim that Gate A, B, or C is live/shippable until the corresponding complete journey is observed and documented in [`STATUS.md`](STATUS.md).
