# Founder Loop demo script

## Record a 3–5 minute walkthrough

Use the verified local cards below as the default recording path. This avoids depending on a fresh roadmap edit or event delivery during recording. Use only demo data. Crop other channels, account identifiers and private conversations from the capture.

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:20 | An ordinary Discord post and the Slack founder inbox | “Founder Loop listens through Switch. The customer writes normally. The founder sees only signals that meet the review rules.” |
| 0:20–1:45 | Product `FL-011`. Open the exact Discord source link, show the demo roadmap context, then show the closed founder card and the single Product verdict. Use the earlier Product `FL-006` decision if you want to explain the Comment modal. | “The roadmap sets what deserves a decision. A shipped item stayed quiet and a follow-up attached to the existing review. The team receives the founder’s decision with the same source link.” |
| 1:45–2:35 | Revenue `FL-012` and the fictional Leads workbook. Show the matching account, USD 24,000 opportunity value, USD 2,000 MRR, and the private Sales verdict. Optionally show `FL-013` as an example of urgent CSM intake. | “The Sheet supplies recorded account data. An urgent renewal risk can reach the founder from a plain Slack message without a lead ID.” |
| 2:35–3:10 | Commitment `FL-010` from Slack `#support-alerts` and its verdict in `#founder-loop-support`. | “A customer outage goes through the same review flow and lands in Support after the founder decides.” |
| 3:10–3:45 | Terminal with `npm run demo` ending in four closed cards, then the README. | “The judge replay also shows General handling a request to meet the founder. The live integration shown earlier runs on standalone Switch and uses fictional Google context.” |

If you want a fresh button click on camera, use an existing eligible card that is still open and for which you intend to record a real verdict. Otherwise show the verified closed state. A Product request can create a fresh card when it is a concrete new request, or when it matches an unused roadmap revision marked `founder_review`. The demo roadmap currently holds its sample rows.

## Credential-free fallback

Run these from the project root with Node.js 22.22.0.

```sh
npm ci
npm test
npm run demo:product
npm run demo
```

Show the Product decision first, then Sales, Support, and General. Point out the original quote, separate assessment, category context and internal handoff. The Product replay ends with one card and two simulated posts. The full replay ends with four cards, eight simulated posts and `all closed: true`. Describe the `fixture://` links as simulated citation markers. The terminal output does not post messages.

Before uploading, check that the recording shows the source and verdict clearly, excludes secrets and unrelated messages, and opens for a signed-out viewer.
