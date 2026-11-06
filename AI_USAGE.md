# AI usage

Working draft. Updated as the build goes, not written at the end.

## Tools and models

| Tool | Model | Used for |
|---|---|---|
| Claude Code (VS Code extension) | Claude Opus 5.5 (`claude-opus-5-5`) | Planning, review, code, tests, docs |
| Claude Code subagent, briefed as a "staff engineer" reviewer | same model | Independent review of the plan before any code |

Agent instruction file: [`CLAUDE.md`](CLAUDE.md), committed. It holds the layer boundaries, the contract rule and the working rules the agent must follow.

Plan: [`PLAN.md`](PLAN.md). Written before any code, reviewed, then changed after the review.

## How I directed the AI

1. **Plan first, no code.** I gave the brief plus my stack choices (SwiftUI, Node + TypeScript, Mailpit, `docker compose up`), and asked for a plan covering: every gap in the acceptance criteria with an assumption and one alternative for me to choose, the architecture with swappable product source and mailer, the API contract, folder structure, iOS config, a test plan, security basics and cuts. Rule: "If a choice changes the design, ask me instead of guessing."
2. **Asked it to judge its own plan.** "Are you designing this as a lead or staff engineer would?" It listed where the plan fell short: too long, no build order, contract written twice, nothing on the PR or the AI workflow, and an untested claim about Xcode 16. The plan was then rewritten.
3. **Lead and staff-engineer review.** One agent wrote a brief as the lead. A second agent reviewed the plan as a staff engineer, with an order to disagree rather than approve, and to check claims instead of assuming. The lead checked the reviewer's facts, pushed back on three points, and the reviewer agreed with all three. The agreed result went into the plan.
4. **Xcode project: created by hand, wired by a checked script.** I created the project in Xcode. The Xcode 26 template writes iOS 26.5, Swift 5 and main-actor-by-default straight into the project file, and those override any `.xcconfig`. Attaching the config files in the GUI would also have meant deleting each overriding setting by hand. So I let the AI make that one edit, under three conditions:
   - Xcode closed first.
   - A script that stops unless every change matches exactly once. It did stop once, on an ambiguous anchor, before writing anything.
   - Proof afterwards: `plutil -lint`, the resolved build settings for both targets and both configurations, a full `xcodebuild test`, and a check of the built app's Info.plist.

   CLAUDE.md was updated to allow this only under those conditions.
5. **The contract fixtures earned their place on the first run.** I had the fixtures generated from the snapshot by a separate script, not by the backend code. The first `/v1/home` test failed: the adapter trimmed a stray trailing space from upstream titles ("…Boat Neck V "), and the fixtures didn't. Trimming is right, so it became a written contract rule (`contract/README.md`) and the fixtures were regenerated: a deliberate contract change, not a fixture edited to make a test pass.
6. *(more to come during the build)*

## Where the AI got it wrong, and how it was caught

| # | What was wrong | How it was caught |
|---|---|---|
| 1 | "Top rated" had two meanings: hand-picked on Home, computed from stars on category pages. The default picks put a 2.2★ product on Home as "top rated". | Staff review; I then checked the ratings in the live data. |
| 2 | Search used plain substring matching. "men" matched 13 of 20 products, including women's items. | Staff review; I re-ran the query on the data (word-start matching gives exactly the 4 men's items). |
| 3 | API tests would have used a separate in-memory product source with its own copy of the search logic, so they tested a copy, not the shipping code. | Staff review. |
| 4 | The plan assumed Fake Store returns 404 for an unknown product. It returns 200 with an empty body. | Staff review; I checked it with `curl`. |
| 5 | The plan pinned Node only in Docker. Vitest 5 needs Node ≥ 22.12; this laptop has Node 20. | Staff review; I checked it with `npm view vitest engines`. |
| 6 | The plan claimed Xcode 16 "should work" without testing it. | My own review, when asked to judge the plan. |
| 7 | The product snapshot was planned under `test/fixtures/`, but snapshot mode needs it inside the runtime Docker image. | Me, while merging the review into the plan. |
| 8 | The first `package.json` left out `vite`. Vitest 5 needs it as a peer dependency and does not install it. | The first `npm test` failed with "Cannot find package 'vite'"; confirmed with `npm view vitest@5.1.0 peerDependencies`. |
| 9 | A `git mv` into a folder that didn't exist yet renamed the asset catalog itself to `Resources`, so it lost its `.xcassets` name. | Listing the folder tree straight after the move. |
| 10 | The fallback title-casing for unknown categories used `\b`, which would turn "men's" into "Men'S". | Re-reading the adapter before writing its tests; now covered by a test. |
| 11 | `ProductTile` used a literal `Color.white`, breaking the "styling only from Theme" rule. | Re-reading the view; now `Theme.Colors.imageBackground`. |
| 12 | The access log printed `/home` instead of `/v1/home` (Express shortens `req.path` inside a mounted router). | Reading the real logs during the simulator run. |
| 13 | Xcode's template file headers carried the full macOS account name into the repo. | A search of files and history for the surname; a shared `IDETemplateMacros.plist` now makes new files' headers empty. |
| 14 | The first enquiry view model mapped server field errors with a nested ternary and a dummy `_ = message`; it worked but was hard to read and easy to break. | Re-reading before writing its tests; rewritten as plain if/else, with a test for errors on fields the form doesn't have. |
| 15 | The thank-you icon used `.font(.system(size:))` in the view, which breaks the "styling only from Theme" rule. | My own boundary grep for literal fonts; moved to `Theme.Fonts.successIcon`. |

## Time log (raw; summary goes in the README)

| Phase | From | To | Notes |
|---|---|---|---|
| Planning + review | before 20:07 (first PLAN.md save) — exact start to confirm | 20:45 | Includes the staff-engineer review |
| Setup (ready checklist) | 20:45 | 21:20 | Colima, Node 24, HTTPS-proxy certificate for Docker, Xcode project, xcconfig wiring |
| Step 0: Home end to end | 21:20 | 21:45 | Backend adapter, cache, `/v1/home`, image proxy; iOS client, Theme, Home; run on simulator |
| Step 1: Product page | 21:45 | 21:50 | Endpoint, screen, navigation; tapped through on the simulator |
| Step 2: Enquiry | 21:50 | 21:58 | Validation, rate limit, SMTP mailer, smoke.sh; form + thank-you; real enquiry from the app arrived in Mailpit |
