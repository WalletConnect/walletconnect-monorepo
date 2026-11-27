# Author prompts

Use the default prompt for each section. Add at most two evidenced narrower
questions and one suggested angle as a short topic fragment. Interpolate at most
one path, symbol, contract, or observed failure. Never quote, propose, or
pre-fill an answer.

## 💡 Why

Default:

> What problem, missing capability, or continuing cost made this change worth
> doing? Explain the reason, not the changed lines.

Use a narrower prompt when evidenced:

- Bug or regression: `What observable failure made this fix necessary, and who experienced it?`
- New capability: `What was impossible before this change, and who needs it?`
- Maintenance or safety: `What continuing cost or risk does this change remove?`
- Wider initiative: `How does this change fit into the wider work?`

A Why answer is required when the live section is empty. Otherwise a blank
response preserves the current section.

## 🧭 Decisions

Default:

> What meaningful choice, rejected alternative, or deliberate limit should the
> reviewer know? `None` is valid.

Use a narrower prompt when the diff shows one:

- Public contract: `What compatibility choice should the reviewer understand?`
- Persisted data: `What rollout or rollback choice should the reviewer understand?`
- State model: `Why did you choose this state representation over the alternative?`
- Security boundary: `What trust-boundary decision should the reviewer challenge?`
- Deliberate scope: `What did you intentionally leave out, and why?`

A Decisions answer is required when the live section is empty; `None` is valid.
Otherwise a blank response preserves the current section.

## 🔎 Worth looking at

Default:

> Where should the reviewer spend attention? Name uncertainty, a non-obvious
> consequence, or a manual check. `Nothing in particular` is valid.

Use a narrower prompt when evidenced:

- Frozen surface: `Which potentially breaking surface should the reviewer inspect?`
- Concurrency or ordering: `Which ordering or race assumption deserves review?`
- External provider: `Which provider behavior remains uncertain or manually verified?`
- Broad movement: `Which moved seam is easiest to misunderstand from the diff?`
- Incomplete automation: `What important behavior does CI not establish?`

A Worth looking at answer is required when the live section is empty; `Nothing
in particular` is valid. Otherwise a blank response preserves the current
section.
