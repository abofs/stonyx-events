# Release Process

This package follows the Stonyx shared release pipeline in
[abofs/stonyx-workflows](https://github.com/abofs/stonyx-workflows). The steps below
are verified against this repo's `.github/workflows/ci.yml`, `publish.yml`,
`security-audit.yml`, and `package.json`'s `prepublishOnly`, plus the reusable
workflow definitions they call (`ci.yml`, `npm-publish.yml`, `security-audit.yml` in
`abofs/stonyx-workflows`, read 2026-11-02) — not copied from `stonyx-workflows/docs`
without checking against what this repo's workflow files actually invoke. The three
workflow files in this repo are byte-for-byte the same thin wrappers as
`stonyx-cron`'s, calling the same reusable workflows with the same inputs.

**npm package:** `@stonyx/events`

## CI (`.github/workflows/ci.yml`)

Runs on every PR targeting `dev`, `main`, or `fix/**`. Delegates entirely to
`abofs/stonyx-workflows/.github/workflows/ci.yml@main`, which on the runner:

1. Checks out with `persist-credentials: false` (so the job's `GITHUB_TOKEN` is never
   written into `.git/config` for the consumer's own install/test scripts to read).
2. `pnpm install --frozen-lockfile`
3. `pnpm test` — for this repo, `pnpm typecheck && node --import tsx
   node_modules/qunit/bin/qunit.js 'test/**/*-test.ts'`, where `typecheck` itself runs
   `pnpm build` first.
4. `pnpm run --if-present build` — an additional, explicit build step whose purpose is
   a docs-import check (every import a consumer can copy out of README/docs must
   resolve against the package's real exports). Already covered here because `pnpm
   test` builds via `typecheck`, but the reusable workflow runs it unconditionally
   since not every `@stonyx/*` consumer's `pnpm test` builds (this repo's `pnpm test`
   does; `stonyx-logs`'s, cited in the reusable workflow's own comments, does not).

Locally, the equivalent is:

```bash
pnpm install --frozen-lockfile
pnpm test
```

Verified by running both in this working tree: install completed with no lockfile
changes, and `pnpm test` passed 31/31 (`# pass 31`, `# fail 0`), including the
`[Unit] Sample surface` export/sample-coverage checks and the `[Unit] Samples`
convenience-function and class-based end-to-end tests. This package makes no use of
fake timers, so no scheduler-style timing rules apply to its test run (contrast
`@stonyx/cron`'s scheduler tests).

## Publish (`.github/workflows/publish.yml`)

Triggers: `repository_dispatch` (`cascade-publish`, fired by a sibling package's
release), `workflow_dispatch` (manual, with `version-type` or `custom-version`), and
`pull_request`/`push` on `dev`/`main`. It calls two reusable workflows with
`secrets: inherit`:

- `npm-publish.yml` — does the version bump, test run, pack, publish, and tag/push.
- `cascade.yml` (needs `publish`) — propagates the newly published version to
  dependent `@stonyx/*` packages (notably `@stonyx/orm`, which depends on this
  package).

Verified from the reusable `npm-publish.yml` source (not inferred from this repo's
thin wrapper alone):

- **Version channel is derived from the trigger**, not hardcoded: PR → `alpha`; push to
  a non-`main` branch, or a cascade dispatch → `beta`; push to `main` → `stable`
  (`patch` bump); `workflow_dispatch` → whatever `version-type`/`custom-version` was
  given. This package has published exactly one stable version ever (`0.1.0`); every
  release since has been a `beta` prerelease — see the discrepancy check below for why
  that matters to the deprecation remediation.
- **Runs `pnpm install` and `pnpm test` again** inside the publish job (with
  `--no-frozen-lockfile` only in cascade mode, otherwise `--frozen-lockfile`), so this
  repo's `prepublishOnly: "npm run build && npm test"` is redundant with, not instead
  of, that step — it fires again inside the packing step below.
- **Packs once to a guarded tarball, not a directory.** The "Pack and guard the
  release artifact" step runs `pnpm pkg get scripts.prepublishOnly` and, since it is
  present here, runs it (`pnpm run prepublishOnly`, i.e. build+test a third time
  counting the earlier `pnpm test`), then `pnpm pack --pack-destination
  "$RUNNER_TEMP/stonyx-pack"`, and inspects the resulting tarball's entry list for
  exactly this repo's historical defect: any path matching
  `^package/(.*/)?\.git(/|$)`. A match aborts the publish. The reusable workflow's own
  comments note `pnpm pack` runs `prepack`/`prepare` but not `prepublishOnly`, and that
  this repo's `files: ["dist", "README.md"]` means packing without running
  `prepublishOnly` first would inspect a near-empty, unbuilt tarball and pass
  vacuously — which is why the explicit `prepublishOnly` run above is load-bearing,
  not redundant busywork, for this specific package.
- **Publishes via `pnpm publish <tarball> --tag <alpha|beta|(none)> --access public
  --no-git-checks`**, authenticated through GitHub OIDC trusted publishing (no static
  npm token in this org) — consistent with this repo's `publishConfig.provenance: true`.
- **Commits the version bump and pushes a tag** (`v<version>`) back to the triggering
  branch, authenticated with a short-lived token applied per-`git`-invocation via
  `GIT_CONFIG_*` rather than written to `.git/config` or a remote URL — the fix for the
  original `.git/config`-credential class of defect, not merely the tarball-content
  guard above. The commit message is `chore: release v<version> [skip ci]`.
- **Creates a GitHub Release** (beta and stable channels) tagged `v<version>`.

This repo's `publish.yml` wrapper matches all of the above exactly: it passes
`version-type`, `custom-version`, and `cascade-source` straight through and does not
add or override any step.

## Security audit (`.github/workflows/security-audit.yml`)

Daily at 08:00 UTC plus manual dispatch. Delegates to
`abofs/stonyx-workflows/.github/workflows/security-audit.yml@main`, which checks out
with `persist-credentials: false`, `pnpm install --frozen-lockfile`, then `pnpm audit
--audit-level moderate` with `continue-on-error: true` (so a finding is reported, not
blocking). Matches this repo's wrapper exactly; no local override to verify beyond that.

## What this doc cannot verify

Branch protection rules, the `CASCADE_PAT`/`NPM_TOKEN`/OIDC trust configuration, and any
AWS or other infrastructure the pipeline may depend on are out of scope for this
document (infrastructure/secrets configuration, not release *process*) and were not
inspected.

## Remediation of the already-published version — discrepancy check

`docs/deprecation-remediation.md` describes a **separate, out-of-band** corrective
action against already-published npm registry metadata: correcting the deprecation
message on `0.1.0`, the one `@stonyx/events` version that shipped
`package/.git/config` — issue
[abofs/stonyx-events#23](https://github.com/abofs/stonyx-events/issues/23). That
document's own status block states, as of 2026-09-04: **NOT YET APPLIED** — `--check`
exits 1, because applying it requires an npm account with publish rights on the
`@stonyx` scope that does not currently exist in this org as a credential anyone
holds (publishing itself goes through per-job OIDC trusted publishing, not a standing
credential, so there is nothing to hand an operator). Nothing observed while writing
this document changes that status — it is a registry-metadata operation outside this
repo's CI, and no workflow run evidence of it having been applied was found.

`0.1.0` is also, per that document, **the only non-prerelease version
`@stonyx/events` has ever published**, and `latest` still points at it, so the
remediation's decision explicitly declines to advance `latest` here and instead ties
that to a *joint* follow-up with `@stonyx/cron` (gated on `abofs/stonyx-cron#34` and
`#36` re-landing) — advancing one package's `latest` semantics without the other would
itself be the inconsistency the doc is trying to avoid. Nothing in this repo's current
`dev` branch state (clean, `beta.72`, no revert markers) changes that joint-gate
reasoning; it remains accurate as a statement of current status, not something this
pass attempted to act on.

Like `stonyx-cron/docs/deprecation-remediation.md`, this document draws an explicit
scope boundary: it is remediation of **already published** artifacts, separate from
**preventing future publishes** from including `.git/`, tracked as a distinct item:
[abofs/stonyx-workflows#39](https://github.com/abofs/stonyx-workflows/issues/39).

**That preventive side is no longer open.** Reading the current reusable
`npm-publish.yml` (the same one this repo's `publish.yml` calls), the "Pack and guard
the release artifact" step described above — which packs to a single tarball and
refuses to publish one containing any `^package/(.*/)?\.git(/|$)` entry — exists in
the workflow today, with inline commentary citing `abofs/stonyx-workflows#39` as its
origin, and is explicitly written to also guard the near-empty-tarball case this
package's `files` field would otherwise create. Checkout steps across `ci.yml`,
`npm-publish.yml`, and `security-audit.yml` all now set `persist-credentials: false`,
and the publish job's own git push authenticates via a per-command `GIT_CONFIG_*`
credential rather than a file on disk — both cited inline as fixes for
`abofs/stonyx-workflows#35`, the credential-in-`.git/config` root cause (though for
this package's own `0.1.0` tarball, the deprecation-remediation doc measured no
credential was ever actually exposed — the defect here was the self-defeating
deprecation text pointing back at itself, not a leaked token). So: **the control that
stops this from recurring is live in the current pipeline; the cleanup of `0.1.0`'s
metadata is the piece still outstanding**, exactly as `deprecation-remediation.md`
states. This is a currency check against the live workflow source, not a re-run of
the remediation script — this document does not hold `@stonyx` npm publish
credentials and did not attempt `--apply` or `--check`.
