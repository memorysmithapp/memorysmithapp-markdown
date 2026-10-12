#!/usr/bin/env bash
# Applies to a repository created from memorysmithapp-template what a template does not copy:
# the description and topics, the merge options, wiki and discussions off, and the ruleset `main`
# protecting the default branch. Issue labels are left as GitHub's defaults.
#
# Run once, right after creating the repository, with gh authenticated as an administrator of it.
# Idempotent: a second run changes nothing and says so.
#
#   scripts/setup-repo.sh <owner>/<repo> "<description>" <topic>[,<topic>...]

set -euo pipefail

usage() {
  echo "usage: $0 <owner>/<repo> \"<description>\" <topic>[,<topic>...]" >&2
  exit 2
}

die() {
  echo "error: $*" >&2
  exit 1
}

for tool in gh jq; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
done

[ $# -eq 3 ] || usage
repo=$1
description=$2
topics_csv=$3

[[ $repo =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || die "the repository must be <owner>/<repo>, got '$repo'"
[ -n "$description" ] || die "the description is empty"
[ -n "$topics_csv" ] || die "at least one topic is required"

topics=$(jq -cn --arg csv "$topics_csv" '$csv | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(. != "")) | unique')
[ "$(jq 'length' <<<"$topics")" -gt 0 ] || die "at least one topic is required"
bad_topic=$(jq -r 'map(select(test("^[a-z0-9][a-z0-9-]{0,49}$") | not)) | first // empty' <<<"$topics")
[ -z "$bad_topic" ] || die "invalid topic '$bad_topic': lowercase letters, digits and hyphens, at most 50 characters"

changes=0
report() {
  printf '  %-17s %s\n' "$1" "$2"
  if [ "$1" = changed ]; then changes=$((changes + 1)); fi
}

info=$(gh api "repos/$repo" 2>/dev/null) || die "cannot read $repo: check that it exists and that gh is authenticated (gh auth status)"
[ "$(jq -r '.permissions.admin' <<<"$info")" = true ] || die "the authenticated account is not an administrator of $repo"

echo "Setting up $repo"

# Description.
if [ "$(jq -r '.description // ""' <<<"$info")" = "$description" ]; then
  report "already in place" "description"
else
  gh api -X PATCH "repos/$repo" -f description="$description" >/dev/null || die "could not set the description"
  report changed "description"
fi

# Topics, compared as a set.
current_topics=$(jq -c '.topics // [] | unique' <<<"$info")
if [ "$current_topics" = "$topics" ]; then
  report "already in place" "topics $(jq -r 'join(",")' <<<"$topics")"
else
  jq -n --argjson names "$topics" '{names: $names}' |
    gh api -X PUT "repos/$repo/topics" --input - >/dev/null || die "could not set the topics"
  report changed "topics $(jq -r 'join(",")' <<<"$topics")"
fi

# Repository settings: merge, squash and rebase allowed; wiki and discussions off.
desired_settings='{"allow_merge_commit":true,"allow_squash_merge":true,"allow_rebase_merge":true,"has_wiki":false,"has_discussions":false}'
settings_diff=$(jq -c --argjson want "$desired_settings" '. as $have | $want | with_entries(select($have[.key] != .value))' <<<"$info")
if [ "$settings_diff" = "{}" ]; then
  report "already in place" "merge options, wiki and discussions off"
else
  gh api -X PATCH "repos/$repo" --input - <<<"$settings_diff" >/dev/null || die "could not change the repository settings"
  report changed "$(jq -r 'to_entries | map("\(.key)=\(.value)") | join(", ")' <<<"$settings_diff")"
fi

# The ruleset `main` on the default branch: no deletion, no force push, changes only through a
# pull request with 0 required approvals, merge, squash and rebase allowed, the status check
# Quality (.github/workflows/quality.yml) required, and no bypass actors.
desired_ruleset=$(cat <<'JSON'
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {"ref_name": {"exclude": [], "include": ["~DEFAULT_BRANCH"]}},
  "bypass_actors": [],
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [{"context": "Quality"}]
      }
    }
  ]
}
JSON
)

# The fields that define a ruleset, in a stable order, so two rulesets compare as text. GitHub
# answers with parameters it fills in by default; only the parameters this script sets are compared.
normalize='{
  name, target, enforcement, conditions,
  bypass_actors: (.bypass_actors // []),
  rules: (.rules | map({type} + (if .parameters then {parameters} else {} end)) | sort_by(.type))
}'
want=$(jq -S "$normalize" <<<"$desired_ruleset")

ruleset_id=$(gh api "repos/$repo/rulesets?includes_parents=false" --jq '.[] | select(.name == "main" and .target == "branch") | .id' 2>/dev/null) ||
  die "cannot read the rulesets of $repo"

if [ -z "$ruleset_id" ]; then
  gh api -X POST "repos/$repo/rulesets" --input - <<<"$desired_ruleset" >/dev/null || die "could not create the ruleset main"
  report changed "ruleset main created"
else
  have=$(gh api "repos/$repo/rulesets/$ruleset_id" | jq -S --argjson want "$want" "$normalize"'
    | .rules |= map(
        . as $rule
        | ($want.rules[] | select(.type == $rule.type) | .parameters // {}) as $keys
        | if .parameters then .parameters |= with_entries(select(.key as $k | $keys | has($k))) else . end
      )')
  if [ "$have" = "$want" ]; then
    report "already in place" "ruleset main (id $ruleset_id)"
  else
    gh api -X PUT "repos/$repo/rulesets/$ruleset_id" --input - <<<"$desired_ruleset" >/dev/null ||
      die "could not update the ruleset main (id $ruleset_id)"
    report changed "ruleset main updated (id $ruleset_id)"
  fi
fi

if [ "$changes" -eq 0 ]; then
  echo "Nothing changed: $repo was already set up."
else
  echo "$changes setting(s) changed on $repo."
fi
