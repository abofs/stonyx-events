# Deprecation Remediation — published `.git/config` version

Tracking issue: [abofs/stonyx-events#23](https://github.com/abofs/stonyx-events/issues/23)
Sibling issue for the same defect in `@stonyx/cron`: [abofs/stonyx-cron#50](https://github.com/abofs/stonyx-cron/issues/50)

## The defect

One published version of `@stonyx/events` — `0.1.0`, published 2026-02-01 — shipped a
`package/.git/config` file inside the npm tarball. It was already deprecated, with
this text:

> This version inadvertently included .git/config. Please upgrade to the latest version.

That message is self-defeating. The `latest` dist-tag points at `0.1.0`, which **is**
the affected version. A user who obeys the notice stays exactly where they are and
sees the same warning again. It is a closed loop.

The severity is the loop, not credential exposure. Measured, the `extraheader` count
on the shipped `.git/config` is 0 — it is a workstation config (SSH remote
`git@github.com:abofs/stonyx-events.git`, branch `stone/initial`, GitLens metadata),
not a CI checkout config. No credential is published.

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

Verified 2026-09-04 by downloading all 68 published `@stonyx/events` tarballs from
`dist.tarball` and running `tar tzf | grep -c '^package/\.git/'` against each.
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

**This requires an npm token with publish rights on the `@stonyx` scope.** It is a
registry metadata operation; there is no code change and nothing to release.

```sh
npm whoami                                  # must succeed
./scripts/deprecation-remediation.sh --apply
./scripts/deprecation-remediation.sh --check
```

`npm deprecate` is idempotent for identical text, so `--apply` is safe to re-run.

Only one version is affected here, so the semver-range hazard that forces
version-by-version application in `@stonyx/cron` does not bite — but the script still
applies from an explicit list, and `--check` asserts the deprecated count is still
exactly 1 afterwards, so an accidental range cannot pass silently.

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
