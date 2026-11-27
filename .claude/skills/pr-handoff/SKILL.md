---
name: pr-handoff
description: Create draft PRs without blocking, then run the author checkpoint when making them ready. Use for PR creation, ready transitions, title or description changes, and reviewer rerouting.
---

# PR handoff

The agent owns the title and agent-generated blocks. The author owns `Why`,
`Decisions`, `Worth looking at`, the breaking-change checkbox, and reviewer
selection. Never infer, grade, challenge, expand, or demand justification for
author prose.

Creating a draft is not a handoff. Do it immediately without asking for author
prose, breaking-change confirmation, or a reviewer. The checkpoint runs only
when the author asks to make the PR ready, or when author-owned content on a
ready PR must change.

## Create or update a draft

1. Resolve the target base and head, then find a matching PR.
   - With no match, fetch the PR template from the target base:

     ```bash
     gh api "repos/{owner}/{repo}/contents/.github/pull_request_template.md?ref=<base>" --jq .content | base64 --decode
     ```

   - For an existing draft, fetch its live title and body. The live author
     sections are authoritative; never reconstruct them from the template.

2. Draft the title from the diff. If the author explicitly asks to refresh the
   title, redraft it. Otherwise preserve an existing title unless the change
   makes it inaccurate. Prepare References, the recap, and Agent context through
   `/visual-recap`. Do not prepare or apply the breaking-change choice yet.

3. Create a new PR with `gh pr create --draft --title ... --body-file`, or
   update the existing draft once with `gh pr edit --title ... --body-file`.
   Leave author-owned sections exactly as they appear in the target-base
   template or live PR. Request no reviewer.

4. Verify with
   `gh pr view --json title,body,baseRefName,headRefName,isDraft`. Report the
   observed draft and remove temporary files. If the author did not ask to make
   it ready, stop.

## Make a PR ready

1. Prepare everything before asking:
   - Fetch the live title and body. If the author explicitly asks to refresh the
     title, redraft it from the diff. Otherwise preserve the live title unless
     the change makes it inaccurate. Reuse existing intent, evidence,
     verification, and classification. Do not spawn an agent, reread the full
     diff, or inspect review history solely for handoff.
   - Refresh References, the recap, Agent context, and the breaking-change
     recommendation through `/visual-recap`.
   - Select prompts from [author-prompts.md](author-prompts.md), assess the
     reviewer route, and resolve every reviewer option through
     [reviewer-routing.md](reviewer-routing.md).

   Do not ask until the title, live body, author prompts, agent blocks,
   classification, and reviewer options are prepared. Write nothing.

2. Ask for `Why`, `Decisions`, and `Worth looking at` together in one free-form
   response. Never offer selectable or pre-filled prose. Apply the blank and
   required-answer rules in [author-prompts.md](author-prompts.md).

   Make a meaning-preserving dictation edit. Remove fillers, false starts,
   repetitions, and empty scaffolding. Correct unambiguous transcription
   errors, grammar, punctuation, and paragraph breaks in plain international
   English. Preserve meaning, idea order, tone, certainty, and domain terms. If
   a word might be meaningful, keep it. Never add an argument or resolve a
   contradiction.

   After receiving the response, show the drafted title and all three resolved
   sections together, including live prose preserved by a blank answer. Use them
   unless the author corrects them. If a required answer is missing, the author
   requests help framing it, or two corrections could change its meaning, ask
   one focused follow-up and use that answer verbatim. Never broaden this into an
   interview.

   Continue only after every required field has an answer and the author has
   seen the exact title and prose that will be written.

3. Open one question-tool modal with two questions:
   - **Breaking change**. Show the `/visual-recap` classification and recommend
     the matching checkbox state.
   - **Reviewer selection**. Show the first page resolved through
     [reviewer-routing.md](reviewer-routing.md).

   If the author chooses reviewer-page navigation, preserve the breaking choice
   and open a reviewer-only modal for the requested page. Repeat until the author
   selects a reviewer route. `Cancel` and `Other` abort the handoff, remove
   temporary files, and leave the PR as a draft. A valid final reviewer route
   authorizes the ready transition.

4. Only after a valid final reviewer route, assemble one body from the live
   draft, approved author answers, checkbox, and prepared agent blocks. Review
   only section and marker integrity. Update the title and description once with
   `gh pr edit --title ... --body-file`, mark the PR ready, then apply the
   reviewer action from [reviewer-routing.md](reviewer-routing.md).

   Verify with one
   `gh pr view --json title,body,baseRefName,headRefName,isDraft,reviewRequests,reviews`.
   Report observed state and remove temporary files. The handoff is complete
   only when the verified PR matches every author choice.

## Reviewer-only reroute

When the author asks only to reroute an open PR, leave the title and description
untouched. Resolve choices through [reviewer-routing.md](reviewer-routing.md),
ask once, apply the choice, and verify it.
