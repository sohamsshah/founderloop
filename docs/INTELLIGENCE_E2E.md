# Next E2E pass

The local agent has Revenue enabled for Discord `#founder-loop-source` and Slack `#sales`, `#customer-success`, and `#support-alerts`. The two fictional Leads records are readable through the demo public export. For the staff promise case, set `COMMITMENT_STAFF_IDS` to the verified sender IDs. Support intake is `#support-alerts`, founder decisions go to `#founder-loop-founder`, and Support verdicts go to `#founder-loop-support`.

| Flow | Posts that should stay quiet | One card to close |
| --- | --- | --- |
| Product | Unknown feature, shipped feature, or a matching roadmap item on hold | Set one demo row to `founder_review` with a question, then post a matching request and a follow-up. Expect one card with the decision question, status, owner, deadline, and original link. Accept and check the Product verdict. |
| Revenue | Generic pricing inquiry, or a Slack approval request linked to the held `DEMO-002` record | In `#customer-success`, post `Lead ID: DEMO-001. The customer may not renew. Can we approve a one-time renewal discount?` Confirm the exact Slack link, recorded deal value, MRR, and decision question. Accept and check one verdict in private `#founder-loop-sales`. |
| Commitment | Routine support request or an undated promise | Post a customer outage in Support, or have a configured staff member post an explicit promise with a deadline. Check the original link and distinction between impact and promise. Decide and confirm one verdict in `#founder-loop-support`. |

For each card, confirm the source link opens the exact original, a repeat does not create another card, and the buttons disappear after the verdict posts. Record any unexpected card or delivery before moving on.
