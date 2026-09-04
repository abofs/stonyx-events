#!/usr/bin/env bash
#
# Remediation for abofs/stonyx-events#23 — rewrite the deprecation message on the
# published @stonyx/events version that shipped `package/.git/config`.
#
# WHY THIS SCRIPT EXISTS
#   The defect is registry metadata, not code. The existing deprecation text says
#   "Please upgrade to the latest version" while the `latest` dist-tag IS the
#   affected version (0.1.0). A user who obeys the notice stays exactly where they
#   are and sees the same warning again — a closed loop.
#
# WHAT THIS SCRIPT DOES NOT DO
#   It does NOT touch any dist-tag. Per the CTO decision on issue #23 (option 2
#   only), `latest` stays at 0.1.0. Advancing it is deferred to a gated follow-up,
#   and must happen for @stonyx/cron and @stonyx/events together or not at all.
#   There is no `npm dist-tag` call anywhere in this file.
#
# REQUIREMENTS
#   An npm ACCOUNT with publish rights on the `@stonyx` scope, authenticated
#   interactively with `npm login`. Not a token.
#
#   There is no long-lived npm credential in this org and none should be minted
#   for this. Publishing uses GitHub OIDC trusted publishing: a short-lived
#   identity, bound to one repo and one package, minted per CI job. It does not
#   exist outside a workflow run and cannot be handed to an operator.
#   (`CASCADE_PAT`, the one secret the publish workflow declares, is a GitHub PAT
#   used for cascade dispatch. It grants nothing on the npm registry.)
#
#   WHO HOLDS THIS ACCESS: every affected version across @stonyx/events and
#   @stonyx/cron is ALREADY deprecated, so `npm deprecate` has been run
#   successfully against this scope before, by someone. Whoever did that holds
#   exactly the access this script needs -- that is the person to ask.
#
#   Verify with `npm whoami` before running.
#
# USAGE
#   ./scripts/deprecation-remediation.sh --check    # read-only; verify state
#   ./scripts/deprecation-remediation.sh --apply    # perform the rewrite
#
# Re-running --apply is safe: `npm deprecate` is idempotent for identical text.

set -euo pipefail

PKG="@stonyx/events"

# The affected set: every published version whose tarball contains at least one
# `package/.git/` entry. Verified 2026-09-04 by downloading all 68 tarballs
# published as of that measurement and running `tar tzf | grep -c '^package/\.git/'` against each.
# Result: exactly one returned a non-zero count; the other 67 returned 0.
# This set is also exactly equal to the set already carrying a `deprecated`
# field, so the rewrite neither widens nor narrows the deprecation.
#
# 0.1.0 is this package's ONLY non-prerelease release, and it is the affected
# one — which is why there is no clean stable version to point `latest` at.
VERSIONS=(
  0.1.0
)

# The replacement text. Points at the CHANNEL rather than a frozen version
# string, matching the template used in abofs/stonyx-cron#50: a frozen string
# goes stale on the next beta bump. The parenthetical resolution is descriptive
# of a point in time and is what makes the message auditable.
read -r -d '' MESSAGE <<'EOM' || true
This version shipped package/.git/config in the published tarball and must not be used. The `latest` tag is NOT a safe upgrade target - it points at this same version. Install from the maintained beta channel instead: npm install @stonyx/events@beta (resolves to 0.1.1-beta.52 as of 2026-09-03).
EOM

usage() { echo "usage: $0 --check | --apply" >&2; exit 2; }

require_auth() {
  if ! npm whoami >/dev/null 2>&1; then
    echo "FATAL: not authenticated to the npm registry." >&2
    echo "       \`npm deprecate\` needs an npm ACCOUNT with publish rights on the" >&2
    echo "       @stonyx scope. Run \`npm login\` and retry." >&2
    echo "       There is no stored npm token in this org and none should be created:" >&2
    echo "       publishing uses OIDC trusted publishing (short-lived, repo- and" >&2
    echo "       package-bound, minted per CI job). Every affected version is already" >&2
    echo "       deprecated, so whoever ran \`npm deprecate\` on this scope before" >&2
    echo "       holds the access this needs." >&2
    exit 1
  fi
  echo "authenticated as: $(npm whoami)"
}

do_apply() {
  require_auth
  echo "applying deprecation text to ${#VERSIONS[@]} version(s) of ${PKG}"
  for v in "${VERSIONS[@]}"; do
    printf '  %-20s ... ' "$v"
    npm deprecate "${PKG}@${v}" "$MESSAGE"
    echo 'ok'
  done
  echo "done. now run: $0 --check"
}

do_check() {
  local fail=0

  # AC2 control first. If the control does not go red, the check is inert and
  # every result below it is void.
  echo "== control: the check must be capable of failing =="
  local ctl ctl_n
  ctl=$(npm pack "${PKG}@0.1.0" --silent 2>/dev/null)
  ctl_n=$(tar tzf "$ctl" | grep -c '^package/\.git/' || true)
  rm -f "$ctl"
  echo "   ${PKG}@0.1.0 package/.git/ entries: ${ctl_n} (expect >=1)"
  if [ "$ctl_n" -lt 1 ]; then
    echo "   FAIL: control returned 0 - the scan is inert, results below are void"
    return 1
  fi
  echo "   control is live"

  # AC2: the named target resolves to something clean.
  echo "== AC2: named target is clean =="
  local beta
  beta=$(npm view "${PKG}@beta" version)
  echo "   ${PKG}@beta resolves to ${beta}"
  for v in "${VERSIONS[@]}"; do
    if [ "$v" = "$beta" ]; then
      echo "   FAIL: beta resolves into the affected set"
      fail=1
    fi
  done
  local tgz n
  tgz=$(npm pack "${PKG}@${beta}" --silent 2>/dev/null)
  n=$(tar tzf "$tgz" | grep -c '^package/\.git/' || true)
  rm -f "$tgz"
  echo "   ${beta} package/.git/ entries: ${n} (expect 0)"
  [ "$n" -eq 0 ] || { echo "   FAIL"; fail=1; }

  # AC1 (refined): the self-reference is gone.
  #
  # The per-version assertion is an EXACT compare against $MESSAGE, not a
  # substring test. A substring test passes on any text that happens to contain
  # the right fragments, so it cannot tell two different corrected texts apart --
  # which is exactly the residue a partial `--apply` finished by a different
  # revision of this script would leave, or a hand-typed rollback approximating
  # the wording. Exact compare makes "the string in the registry is the string
  # this repo documents" the thing being asserted. The substring tests are kept,
  # but only to label WHY a version failed.
  echo "== all ${#VERSIONS[@]} version(s) carry the exact replacement text =="
  for v in "${VERSIONS[@]}"; do
    local msg
    msg=$(npm view "${PKG}@${v}" deprecated 2>/dev/null || true)
    if [ -z "$msg" ]; then
      echo "   FAIL ${v}: no deprecation message at all"
      fail=1
    elif [ "$msg" != "$MESSAGE" ]; then
      if [[ "$msg" == *"the latest version"* ]]; then
        echo "   FAIL ${v}: still says 'the latest version' (not yet applied)"
      elif [[ "$msg" != *"${PKG}@beta"* ]]; then
        echo "   FAIL ${v}: does not name ${PKG}@beta"
      else
        echo "   FAIL ${v}: text differs from MESSAGE (mixed/stale wording)"
      fi
      fail=1
    fi
  done
  [ "$fail" -eq 0 ] && echo "   all ${#VERSIONS[@]} carry the corrected text"

  # AC4: latest was deliberately NOT moved.
  echo "== AC4: latest was deliberately not moved =="
  local latest
  latest=$(npm view "${PKG}" dist-tags.latest)
  echo "   latest = ${latest} (expect 0.1.0)"
  [ "$latest" = "0.1.0" ] || { echo "   FAIL: latest moved - option 1 was executed out of scope"; fail=1; }

  # Cross-package consistency: cron's latest must not have moved either.
  echo "== cross-package consistency with abofs/stonyx-cron#50 =="
  local cron_latest
  cron_latest=$(npm view "@stonyx/cron" dist-tags.latest)
  echo "   @stonyx/cron latest = ${cron_latest} (expect 0.2.0)"
  [ "$cron_latest" = "0.2.0" ] || { echo "   FAIL: the two packages now have different latest semantics"; fail=1; }

  # AC5: no collateral deprecation.
  echo "== AC5: no collateral deprecation =="
  local count
  count=$(curl -sL "https://registry.npmjs.org/@stonyx%2Fevents" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(Object.keys(p.versions).filter(v=>p.versions[v].deprecated!==undefined).length)})')
  echo "   deprecated version count = ${count} (expect ${#VERSIONS[@]})"
  [ "$count" -eq "${#VERSIONS[@]}" ] || { echo "   FAIL: deprecation set changed size - range was over-broad"; fail=1; }

  echo
  [ "$fail" -eq 0 ] && echo "ALL CHECKS PASS" || echo "CHECKS FAILED"
  return "$fail"
}

[ $# -eq 1 ] || usage
case "$1" in
  --check) do_check ;;
  --apply) do_apply ;;
  *) usage ;;
esac
