#!/usr/bin/env bash
# Applies to a repository created from memorysmithapp-template what a template does not copy:
# the description and topics, the merge options, wiki and discussions off, the ruleset `main`
# protecting the default branch, write on the repository for the organization's team `maintainers`,
# and the branch protection of the default branch letting only that team push to it and merge into
# it. Issue labels are left as GitHub's defaults.
#
# Run once, right after creating the repository, with gh authenticated as an administrator of it,
# in an organization that has the team `maintainers`.
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

# Only the team `maintainers` merges to the default branch, so the repository belongs to an
# organization that has that team, and the default branch exists to be protected.
org=${repo%%/*}
team=maintainers
[ "$(jq -r '.owner.type' <<<"$info")" = Organization ] ||
  die "$repo is not owned by an organization: only the team $team of an organization merges to its default branch"
gh api "orgs/$org/teams/$team" >/dev/null 2>&1 || die "the organization $org has no team $team, or gh cannot read it"
branch=$(jq -r '.default_branch' <<<"$info")
gh api "repos/$repo/branches/$branch" >/dev/null 2>&1 || die "the default branch $branch of $repo does not exist yet: push a first commit"

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

# The team `maintainers` needs write on the repository for the branch protection to name it; a
# higher role is left as it is.
role=$(gh api -H "Accept: application/vnd.github.v3.repository+json" "orgs/$org/teams/$team/repos/$repo" --jq '.role_name' 2>/dev/null) || role=none
case $role in
  write | maintain | admin)
    report "already in place" "team $team has $role"
    ;;
  *)
    gh api -X PUT "orgs/$org/teams/$team/repos/$repo" -f permission=push >/dev/null ||
      die "could not give the team $team write on $repo"
    report changed "team $team given write (was $role)"
    ;;
esac

# The branch protection of the default branch: only the team `maintainers` pushes to it, and so
# only that team merges a pull request into it; administrators included, no force push, no
# deletion, and no review or status check of its own, which are the ruleset's. For a member of the
# team a merge is a permission, not a bypass.
desired_protection=$(jq -cn --arg team "$team" '{
  required_status_checks: null,
  enforce_admins: true,
  required_pull_request_reviews: null,
  restrictions: {users: [], teams: [$team], apps: []},
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: true,
  required_conversation_resolution: false,
  lock_branch: false,
  allow_fork_syncing: false
}')

# GitHub answers each setting as an object, and the restrictions with whole users, teams and apps;
# both sides are brought to the shape of the request, names sorted, before they compare as text.
normalize_protection='{
  required_status_checks: (if .required_status_checks then {strict: .required_status_checks.strict, contexts: (.required_status_checks.contexts | sort)} else null end),
  enforce_admins: (.enforce_admins | if type == "object" then .enabled else . end),
  required_pull_request_reviews: (if .required_pull_request_reviews then "set" else null end),
  restrictions: (if .restrictions then {
    users: (.restrictions.users | map(if type == "object" then .login else . end) | sort),
    teams: (.restrictions.teams | map(if type == "object" then .slug else . end) | sort),
    apps: (.restrictions.apps | map(if type == "object" then .slug else . end) | sort)
  } else null end),
  required_linear_history: (.required_linear_history | if type == "object" then .enabled else . end),
  allow_force_pushes: (.allow_force_pushes | if type == "object" then .enabled else . end),
  allow_deletions: (.allow_deletions | if type == "object" then .enabled else . end),
  block_creations: (.block_creations | if type == "object" then .enabled else . end),
  required_conversation_resolution: (.required_conversation_resolution | if type == "object" then .enabled else . end),
  lock_branch: (.lock_branch | if type == "object" then .enabled else . end),
  allow_fork_syncing: (.allow_fork_syncing | if type == "object" then .enabled else . end)
}'
want_protection=$(jq -S "$normalize_protection" <<<"$desired_protection")

if protection=$(gh api "repos/$repo/branches/$branch/protection" 2>/dev/null); then
  have_protection=$(jq -S "$normalize_protection" <<<"$protection")
elif gh api "repos/$repo/branches/$branch/protection" 2>&1 | grep -q 'HTTP 404'; then
  have_protection=none
else
  die "cannot read the branch protection of $branch on $repo"
fi

if [ "$have_protection" = "$want_protection" ]; then
  report "already in place" "branch protection of $branch (only $team merges)"
else
  gh api -X PUT "repos/$repo/branches/$branch/protection" --input - <<<"$desired_protection" >/dev/null ||
    die "could not set the branch protection of $branch on $repo"
  if [ "$have_protection" = none ]; then
    report changed "branch protection of $branch created (only $team merges)"
  else
    report changed "branch protection of $branch updated (only $team merges)"
  fi
fi

if [ "$changes" -eq 0 ]; then
  echo "Nothing changed: $repo was already set up."
else
  echo "$changes setting(s) changed on $repo."
fi
