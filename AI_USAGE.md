# AI usage

"I" is me, the engineer. "The agent" is the AI coding tool. The agent wrote most of the code, tests and docs. I chose the stack and every assumption, gated each step and commit, and tested the app on the simulator. Most of the mistakes below were caught by a second reviewing agent or by tests, not by me reading code. I've been explicit about that in the "Caught by" column.

## Tools

| Tool | Model | Used for |
|---|---|---|
| Claude Code (VS Code extension) | Claude Opus 5.5 (`claude-opus-5-5`) | Plan, code, tests, docs |
| A second Claude Code agent, briefed as a staff-engineer reviewer | same | Reviewing the plan before any code, and the finished repo before submitting |

- **Agent instructions:** [`CLAUDE.md`](CLAUDE.md), committed. It covers the layer rules, "the contract fixtures are the spec", the tests that must pass before "done", and no new dependencies or commits without my yes.
- **Plan:** [`PLAN.md`](PLAN.md), written and reviewed before any code. Where the build differed from it: [DECISIONS.md](DECISIONS.md#where-the-build-differed-from-the-plan).

## How the work was run

- **One step at a time, in the plan's order:** Home, then Product, then Enquiry, then Category and Search, then docs. The agent announced each change before making it. Each step was committed only when its tests passed and I said yes.
- **Each step was run on the simulator against the real stack.**
  - Home was checked by the agent from a screenshot and the API log.
  - From the product page on, I tapped through each step myself, and the agent confirmed from the API's access log. For example, my test enquiry arrived in Mailpit as reference `aa9c41b5`.
- **Claims needed evidence:** test counts, real HTTP responses, resolved Xcode settings, the email in Mailpit.

## Key prompts and moments

1. **Plan first; the decisions are mine.**
   > *"Do NOT write code yet. … Every gap in the acceptance criteria. For each one: your proposed assumption and one alternative. I will choose. … If a choice changes the design, ask me instead of guessing."*

   This produced the gap table I chose from (PLAN.md section 1).

2. **Make it judge its own plan.**
   > *"You are designing this take home project as a lead/staff engineer would do?"*

   The agent listed weaknesses in its own plan: too long, no build order, the API contract written twice, an untested Xcode claim. The shared contract fixtures and the "thin slice first" build order came from this.

3. **A second agent whose job was to disagree.**
   > *"If you act yourself as a lead and one subagent acting like staff engineer and discuss this task … fill up the gaps … while being thorough."*

   The reviewer found the three biggest design bugs below (#1–#3). The lead agent re-checked them against the live API before accepting. It also pushed back on three of the reviewer's points, and the reviewer agreed with all three.

4. **The contract caught a real difference on its first run.** The fixtures are made by [`contract/generate_fixtures.py`](contract/generate_fixtures.py), separately from the backend code. The first `/v1/home` test failed: the backend trimmed a trailing space from an upstream title, and the fixtures didn't. Trimming became a written contract rule. It was a deliberate change, not a fixture edited to make a test pass.

5. **A final review of the finished repo before submitting.**
   > *"Review the project entirely, docs and others. Think as a lead staff engineer."*

   A fresh agent reviewed the repo cold, with no view of my conclusions. It found:
   - doc claims the code didn't back up
   - an enquiry that could be sent without the customer knowing (#5)
   - a weak style rule (#6)
   - private notes about my setup in the committed plan (#7)

   The lead agent re-checked every finding. Two were wrong, and it said so: the iOS test count and the need for a shared Xcode scheme. The rest were fixed, and the plan's history was cleaned.

## What the AI got wrong, and who caught it

| # | Mistake | Caught by | Fix |
|---|---|---|---|
| 1 | "Top rated" had two meanings: hand-picked on Home, computed from stars on category pages. The first defaults put a 2.2★ product on Home as "top rated". | Reviewer agent (plan review) | One meaning: the products the business chose |
| 2 | Search used plain substring matching. "men" matched 13 of 20 products, including women's items. | Reviewer agent (plan review) | Match at the start of a word: exactly the 4 men's items |
| 3 | The planned API tests ran on a fake product source with its own copy of the search code, so they'd have tested a copy, not the shipping code. | Reviewer agent (plan review) | Tests run the real adapter on the committed snapshot |
| 4 | The boundary script passed three rules without running them: an empty array under `set -u` in macOS's bash 3.2, with the error hidden. | The agent, from a warning line in its own output | Errors now fail the check. Every rule was proven by planting a violation. |
| 5 | Cancel still worked while an enquiry was sending, and the app gave up (20 s) before the server could (~40 s). The email could go out while the customer saw an error, so they'd send it again. | Reviewer agent (final review) | Cancel is disabled while sending. The server's worst case (~25 s) is now inside the app's 30 s. Idempotency is listed as next. |
| 6 | "All styling comes from the Theme, enforced" was false. Two literals were left, and the rule missed them. Its widened pattern then still missed two kinds, because `git grep` here doesn't support `\b`. | Reviewer agent (final review); then proving the rule | Literals moved into the Theme. The rule was rewritten and each kind of literal planted to prove it fails. |
| 7 | The committed plan contained private notes about my setup, an "interview prep" section, and a claim that I wrote the PR text. | Reviewer agent (final review) | Removed, including from every earlier commit (only PLAN.md changed in each) |

Ten smaller ones were fixed on the way:
- a file move that renamed the asset catalog
- a title-casing regex that wrote "Men'S"
- a literal colour in a view
- an access log missing `/v1`
- Xcode file headers carrying my full name
- a hard-to-read error mapping
- `vite` missing from `package.json`
- an empty upstream list wiping the cache
- a test that didn't test a real double tap
- an over-claimed swap story in DECISIONS

## Time log

From commit times. The start is my estimate.

| Phase | From | To | Minutes |
|---|---|---|---|
| Planning: plan, self-critique, reviewer agent, rework | ~19:45 | 20:45 | ~60 |
| Setup: Docker runtime, containers on an HTTPS-inspecting network, Xcode project and settings | 20:45 | 21:20 | 35 |
| Building with tests, one commit per step. Includes ~15 min of my own simulator runs. | 21:20 | 22:07 | 47 |
| Scripts, README, DECISIONS, fresh-copy check | 22:07 | 22:20 | 13 |
| Final review by a second agent, fixes, history clean-up, formatters, docs | 22:20 | 23:00 | 40 |
| **Total** | | | **~3 h 15 min** |
