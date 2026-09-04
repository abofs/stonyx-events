# Deprecation Remediation — published `.git/config` version

Tracking issue: [abofs/stonyx-events#23](https://github.com/abofs/stonyx-events/issues/23)
Sibling issue for the same defect in `@stonyx/cron`: [abofs/stonyx-cron#50](https://github.com/abofs/stonyx-cron/issues/50)

> **Status: NOT YET APPLIED as of 2026-09-04.** `0.1.0` still carries the original
> self-defeating text. `--check` exits 1. Applying requires an npm account with publish
> rights on the `@stonyx` scope; no such credential exists in this org today. Update this
> block — do not delete it — when `--apply` has been run and `--check` prints
> `ALL CHECKS PASS`.

## The defect

One published version of `@stonyx/events` — `0.1.0`, published 2026-02-01 — shipped a
`package/.git/config` file inside the npm tarball. It was already deprecated, with
this text:

> This version inadvertently included .git/config. Please upgrade to the latest version.

That message is self-defeating. The `latest` dist-tag points at `0.1.0`, which **is**
the affected version. A user who obeys the notice stays exactly where they are and
sees the same warning again. It is a closed loop.

## Credential exposure — none, and this is measured rather than assumed

**For this package the severity is the loop, not credential exposure.** Re-measured
2026-09-04 by downloading `0.1.0` from `dist.tarball`, extracting it, and grepping the
shipped `package/.git/config`: `extraheader=0`, remote
`git@github.com:abofs/stonyx-events.git`, branch `stone/initial`, GitLens metadata. That
is a workstation config, not a CI checkout config. **No credential is published in
`@stonyx/events`.**

The `git@` remote is the load-bearing detail. A CI checkout writes an `https://` remote
plus an `http.extraheader` credential; a workstation clone does not.

### This is where the two runbooks deliberately diverge

The sibling `@stonyx/cron` doc does **not** say this, and that is not an oversight. The
same measurement run over cron's 22 affected tarballs found that `0.2.0` is metadata-only
like this one, but `0.2.1-alpha.0` and `0.2.1-beta.0` through `beta.19` — 21 versions —
each shipped an `http.extraheader` credential (four distinct tokens, all confirmed revoked
on 2026-09-04 by HTTP 401). See
[stonyx-cron/docs/deprecation-remediation.md](https://github.com/abofs/stonyx-cron/blob/dev/docs/deprecation-remediation.md).

The two documents share wording where the facts are shared and diverge where they are not.
Do not sync this section to cron's; they are kept accurate rather than identical. The
*remediation* — the replacement text and the script mechanics — is common to both.

## The decision

Per the CTO decision on issue #23: **correct the deprecation text only. Do not
advance the `latest` dist-tag.**

`latest` is vestigial in this org — consumers track the beta line via
`pnpm.overrides` — and moving it would change what unpinned installs receive for the
first time in this package's history.

There is a second reason specific to this package. **`0.1.0` is the only
non-prerelease version `@stonyx/events` has ever published, and it is the affected
one.** There is no clean stable version to advance `latest` to; every clean candidate
is a prerelease. Advancing `latest` is therefore not "pick the next stable" — it is a
change in what `latest` *means*, for this package and by extension across the org.

## Why this package does not proceed on its own

On this package's own facts there is no obstacle. `@stonyx/events` was **not** in the
2026-09-01 revert wave — no revert PR exists on the repo and `origin/dev` runs
`beta.43` → `beta.52` unbroken — so `0.1.1-beta.52` is clean with no governance
objection, and `latest` *could* be advanced here today.

That is exactly the trap. `@stonyx/cron` cannot advance its `latest` right now: every
candidate there either re-lands the fixes PR #49 deliberately rewound, or carries two
open `priority-critical` defects. Advancing `latest` here while cron's stays at
`0.2.0` would leave the two packages with different `latest` semantics — the precise
red state issue #23's AC4 names.

**Option 1 is executed for both packages together, or for neither.** It is deferred
to a gated follow-up, gated on abofs/stonyx-cron#34 and #36 re-landing.

## Scope boundary

This is remediation of **already-published** artifacts. Preventing future publishes
from including `.git/` is a separate control tracked in
[abofs/stonyx-workflows#39](https://github.com/abofs/stonyx-workflows/issues/39).
Neither blocks the other.

Unpublishing is not available — npm does not permit it past 72 hours. `0.1.0` is
permanent; only its metadata can change.

## Affected versions

Verified 2026-09-04 by downloading all 68 `@stonyx/events` tarballs published as of that
measurement from `dist.tarball` and running `tar tzf | grep -c '^package/\.git/'` against each.
Exactly one returned a non-zero count. The other 67 returned 0.

That set is exactly equal to the set already carrying a `deprecated` field — no
affected version is missing a deprecation, and no clean version has one.

```
0.1.0
```

The sibling package `@stonyx/cron` has 22 affected versions. See
[abofs/stonyx-cron#50](https://github.com/abofs/stonyx-cron/issues/50).

## Replacement text

```
This version shipped package/.git/config in the published tarball and must not be used. The `latest` tag is NOT a safe upgrade target - it points at this same version. Install from the maintained beta channel instead: npm install @stonyx/events@beta (resolves to 0.1.1-beta.52 as of 2026-09-03).
```

This is the same template used for `@stonyx/cron`, differing only in the package name
and the parenthetical resolution — the cross-package consistency the issues require.

The message names the **channel**, not a frozen version string. A frozen string goes
stale on the next beta bump; a channel pointer describes where the maintained line
already is. It stays falsifiable — resolve the tag at check time and assert the
resolution is not `0.1.0` — and it cannot regress, since the only affected version is
the very first release and `beta` only advances.

## Applying it

**This requires an npm account with publish rights on the `@stonyx` scope, authenticated
interactively with `npm login`. It is not a token, and there is no token to go looking
for.** It is a registry metadata operation; there is no code change and nothing to
release.

### There is no npm publish token in this org

Publishing authenticates via **GitHub OIDC trusted publishing**
(`stonyx-workflows/docs/release.md:51,57`). The identity is minted per CI job, bound to a
specific repository and package, and lives only for the duration of that job. It does not
exist outside a workflow run and cannot be handed to an operator.

`CASCADE_PAT` — the one secret the publish workflow declares — is a **GitHub** PAT used
for cascade dispatch. It grants nothing on the `@stonyx` npm scope and is irrelevant here.

An earlier revision of this runbook asserted the credential was an org-level GitHub
secret, supported by `gh secret list --org abofs` returning HTTP 403. That 403 proves only
that org-secret *enumeration* failed; it was converted into a positive claim about what
one of those secrets is, and the workflow source falsifies it.

Do **not** mint a standing org-wide npm token to work around this. That escalation shape
is what [abofs/stonyx-workflows#35](https://github.com/abofs/stonyx-workflows/issues/35)
exists to prevent.

### Who to ask

`0.1.0` here — and all 22 affected `@stonyx/cron` versions — are **already deprecated**.
That means `npm deprecate` was successfully run against this scope at some point, by
someone. Whoever did that holds exactly the access this script needs. That turns a vague
"find someone with credentials" into a specific, answerable question, and it is the
fastest route to an executor.

```sh
./scripts/deprecation-remediation.sh --check   # read-only; run this FIRST
npm login --registry https://registry.npmjs.org
npm whoami --registry https://registry.npmjs.org   # must succeed
./scripts/deprecation-remediation.sh --apply
./scripts/deprecation-remediation.sh --check   # must print ALL CHECKS PASS
```

`npm deprecate` is idempotent for identical text, so `--apply` is safe to re-run.

Only one version is affected here, so the semver-range hazard that forces
version-by-version application in `@stonyx/cron` does not bite — but the script still
applies from an explicit list, and `--check` asserts the deprecated count is still
exactly 1 afterwards, so an accidental range cannot pass silently.

### Rolling back

**Do not run `npm deprecate <pkg>@<version> ""`.** The empty-string form does not restore
the previous message — it *un-deprecates* the version, deleting the `deprecated` field
outright. That is the worst available outcome for this package specifically: `0.1.0` is
the only affected version, the only non-prerelease `@stonyx/events` has ever published,
and what the `latest` dist-tag points at. Clearing its `deprecated` field removes the only
warning on the exact version an unpinned `npm install @stonyx/events` resolves to, leaving
a `.git/config`-bearing tarball shipping silently. That is strictly worse than either the
original text or the corrected one, and it is the first thing an operator reaching for an
undo will find in the `npm deprecate` docs.

The correct rollback is to **re-apply the original deprecation string**. That string is
quoted verbatim under [The defect](#the-defect) above; for `@stonyx/events` the rollback
value is:

```
This version inadvertently included .git/config. Please upgrade to the latest version.
```

Apply it to `0.1.0` from the explicit version list, never as a semver range. Afterwards
`--check` is *expected* to exit 1, reporting `0.1.0` as `still says 'the latest version'`;
that is the pre-remediation red state restored, not a failed rollback.

Rolling back reinstates the closed loop this remediation exists to fix, so it is a last
resort rather than a routine undo. The change is registry metadata only and is reversible
in both directions — there is nothing lost by leaving the corrected text in place while a
concern is investigated.

## Verification

`--check` is read-only and needs no credentials. It runs a control first: it packs
`@stonyx/events@0.1.0` and asserts at least one `package/.git/` entry. If that control
returns 0 the scan is inert and every result below it is void, so the script aborts
rather than reporting a false pass. It also asserts `@stonyx/cron`'s `latest` has not
moved, so the cross-package consistency requirement is machine-checked rather than
assumed.

Run against the registry on 2026-09-04, before the rewrite, `--check` exits 1 and
reports `0.1.0` still carrying `the latest version`, with the control live and the
clean-target, dist-tag, cross-package and collateral checks green. That is the
expected red state; it goes green once `--apply` has been run.

### Evidence recorded for the acceptance criteria

Fresh packs from the registry, with controls, 2026-09-04:

```
@stonyx/events@0.1.1-beta.52  -> package/.git/ entries: 0
@stonyx/events@0.1.0          -> package/.git/ entries: 1     (control: check is live)
@stonyx/cron@0.2.1-beta.95    -> package/.git/ entries: 0
@stonyx/cron@0.2.0            -> package/.git/ entries: 1     (control: check is live)
```

The named target boots. Clean-directory `npm install @stonyx/events@beta` resolved
`0.1.1-beta.52`, which declares **no runtime dependencies**, so unlike `@stonyx/cron`
a bare load is sufficient evidence here — it does not require Stonyx to be
initialized first:

```
$ node -e "import('@stonyx/events').then(...)"
LOADED. exports: clear, default, emit, once, reset, setup, subscribe, unsubscribe
BOOT OK
```

Exit code 0, all eight public exports present.
