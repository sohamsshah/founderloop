# Founder Loop release status

Updated 7 November 2026. The submission scope is a local Switch agent with Discord and Slack intake and four decision routes. The judge run uses simulated fixtures and works without service credentials.

| Flow | Verified live on local standalone Switch |
| --- | --- |
| Product | `FL-011` closed after Accept. A shipped manual-exports request stayed quiet. The dashboard-reporting request and a follow-up grouped under the same roadmap revision. The founder opened the exact Discord message. One private Product verdict carried the same citation, and Slack removed the founder controls. The demo roadmap row was restored to hold afterward. |
| Revenue | `FL-012` closed after Accept. The Sales message linked to the exact Slack source, matched fictional lead `DEMO-001`, and showed USD 24,000 opportunity value and USD 2,000 current MRR. One private Sales verdict and the closed-card edit were delivered. |
| Urgent Revenue intake | `FL-013` arrived from Slack `#customer-success` and matched the held fictional Northwind record through the public Sheet export. The cited card closed after Accept. |
| Commitment | `FL-010` closed after Accept. The outage report from `#support-alerts` had an exact Slack citation and produced one verdict in `#founder-loop-support`. |
| General | `FL-024` closed after Accept in the private founder room. |

Earlier Product checks verified the Slack Comment modal (`FL-006`) and a Reject text command (`FL-004`). SQLite preserves the resume cursor and the delivery outbox across restarts.

Product and Revenue used public Google exports of demo data. The extended Leads schema is read-only in Founder Loop.

The source package includes the app, lockfile, Dockerfile, Compose config, fixtures, and tests. Live setup uses the operator’s own Switch registration, bridges, Slack rooms and Google references. See [live setup](ENVIRONMENT_SETUP.md), [judge run](../README.md#run-locally), and [submission](SUBMISSION.md).
