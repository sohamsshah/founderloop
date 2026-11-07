# Founder Loop hackathon submission

**Title** — Founder Loop · From customer signal to founder decision

**Project description** — Founder Loop helps small teams turn customer conversations into decisions with evidence. A single Switch agent listens to authorized Discord and Slack rooms and surfaces actionable signals in private Slack. Product checks the roadmap in Google Docs. Revenue checks the Leads Sheet and can escalate urgent account risks without a lead ID. Commitment surfaces serious support issues, and General handles requests for the founder to respond or act. Every card shows the original message and a link to that exact post. The founder can accept, reject, or comment in Slack. Founder Loop sends one sourced verdict to the appropriate private channel and closes the card.

**Built with** — Switch Rooms and the custom agent WebSocket, Node.js 22, SQLite, Slack Block Kit and Socket Mode, and Google Docs and Sheets. The agent runs locally alongside the standalone Switch Docker server.

| Live local proof | What to show |
| --- | --- |
| Product `FL-011` | A Discord request matched a roadmap item under review. A shipped request stayed quiet and a follow-up grouped with the existing item. Accept sent one Product verdict and removed the founder controls. |
| Revenue `FL-012` | A Sales message matched the fictional demo lead in the Sheet. The card showed USD 24,000 opportunity value and USD 2,000 monthly recurring revenue. Accept sent one Sales verdict and closed the card. |
| Commitment `FL-010` | A Slack customer outage in `#support-alerts` reached the founder and produced one Support verdict in `#founder-loop-support`. |
| General `FL-024` | A founder follow-up request closed after Accept, with the verdict kept in the private founder room. |

**Judge run** — From the project root with Node.js 22.22.0, run `npm ci`, `npm test`, `npm run demo:product`, and `npm run demo`. The fixture replays print simulated cards and verdicts and require no messaging or Google credentials. Product closes one card, and the full demo closes four, including a General request to meet the founder.

**Demo environment** — Local standalone Switch, Discord and Slack, a demo Google roadmap, and a read-only fictional Leads workbook.

**Submission attachments** — Use the tested source snapshot or a repository commit containing the same changes. Add a sanitized 3–5 minute walkthrough link after recording. See the [recording script](DEMO_SCRIPT.md), [live setup](ENVIRONMENT_SETUP.md), and [evidence](STATUS.md).
