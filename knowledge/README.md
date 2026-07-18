# Knowledge Base

This folder is the project's compound knowledge: ideas, evaluations,
measurements, and design reasoning that are worth keeping but don't belong in
code comments or the public README. It grows over time — documents here are
living and should be updated in place as understanding improves.

What goes here:

- **Ideas** — proposals and backlogs, ranked and with enough context that they
  can be picked up months later.
- **Evaluations** — experiments that were tried, with the measured outcome.
  Negative results stay in: "tried, no measurable effect" prevents re-doing
  the same work.
- **Knowledge** — hard-won understanding of the system (scaling behavior,
  architectural trade-offs, gotchas) that isn't derivable from the code alone.

Conventions:

- One topic per file, lowercase filenames (e.g. `performance.md`).
- Claims should be backed by measurements where possible; note the date,
  commit/branch, and setup so results can be reproduced and re-checked.
- Update existing documents instead of creating parallel ones; mark items as
  done/reverted/superseded rather than deleting them, so the history of what
  was tried remains visible.

## Contents

- [performance.md](performance.md) — performance optimization backlog with
  measured results from the load test (July 2026); covers server code and the
  load-test harness.
