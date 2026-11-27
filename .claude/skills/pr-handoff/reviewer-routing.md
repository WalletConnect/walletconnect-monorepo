# Reviewer routing

The author owns reviewer selection. Resolve every option before the final
handoff modal. Recommend a route, never a person.

## Assess

Record only concrete obligations from three pillars:

| Pillar | Obligation |
|---|---|
| Security | Trust boundaries, authorization, secrets, signing, funds movement, replay, or abuse resistance |
| Public contract | Behavior consumed by another release, repository, SDK, API client, or stable wire format |
| Persistent data | Schema, serialization, keys, indexes, migration, rollout, rollback, or historical-row compatibility |

Each obligation must be a reviewer question backed by a changed path, symbol,
schema, or seam. Record missing evidence as an unknown; unknowns and unfamiliar
code do not change the recommendation. Recommend `General pool` with no
obligation and the specific-reviewer route otherwise. State the evidence. Never
rank people or inspect review history.

## Resolve options

1. Enumerate the target-base tree for GitHub's supported ownership-file locations:
   `.github/`, the repository root, then `docs/`. In that precedence order, select
   a file whose basename equals `CODEOWNERS` case-insensitively, then fetch the
   exact path returned by the tree. Resolve owning teams for changed paths and
   fetch every member through GitHub's paginated team-members endpoint. No
   matching file yields no eligible CODEOWNERS login.
2. Exclude the PR author and bots. Sort logins alphabetically. Label requested
   or effectively approved reviewers `already covered`.
3. Build paginated reviewer questions:
   - `General pool` means no explicit request; existing CODEOWNERS routing
     applies.
   - With no eligible login, show `General pool` and `Cancel`.
   - On the first page, show `General pool`, up to three sorted logins, and
     `More reviewers` when logins remain.
   - On later pages, show `Previous page`, up to three sorted logins, and
     `More reviewers` when another page is needed. On the final page,
     `Previous page` may sit beside up to four remaining logins.
   - A navigation choice opens the requested page and does not authorize a PR
     write.

The question tool supports two to five visible options and renders `Other`
automatically. Do not solicit or accept typed reviewer logins. Treat `Other` as
cancellation. Mark `General pool` as recommended when no obligation exists.
For the specific-reviewer route, state the recommendation without marking a
person.

## Apply

`General pool` and `already covered` cause no reviewer-request write. `Cancel`
aborts the handoff and leaves the draft unchanged. Otherwise, after the PR is
ready, add the selected reviewer with:

```bash
gh pr edit <pr-number> --add-reviewer <author-selected-login>
```

Never remove an existing request. Request nobody while the PR is a draft; keep
the selection only in the current session for an authorized ready transition.
Include `reviewRequests,reviews` in the caller's final `gh pr view`; when
rerouting alone, verify those fields directly. Persist no assessment,
recommendation, decision, or routing metadata in the PR description or
comments. Do not rerun after later pushes unless the author asks to reroute.
