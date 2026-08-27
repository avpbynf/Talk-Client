#!/bin/sh
# Refuse a push that would land on dev or main.
#
# Both branches are reached by pull request and by the "Rebase and merge" button,
# the release included. The remote refuses this too, but only for an account
# without administrative rights: the owner's own push goes through, which is
# exactly the hand this gate has to stop. Paid once, on a release that tried to
# fast-forward main because the history would have been prettier.
#
# Reads the PreToolUse payload on standard input and answers on the exit code:
# 0 lets the command run, 2 refuses it and shows what follows on standard error.

payload=$(cat)

case "$payload" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

# Only a push whose destination is one of the two. A branch merely named after
# them, "fix-main-window" or "dev-notes", is none of this gate's business, so the
# reference has to end where a reference ends: a quote, a space, a semicolon or
# the end of the command.
if printf '%s' "$payload" | grep -Eq '(:|[[:space:]])(refs/heads/)?(main|dev)([[:space:]"\\;&|]|$)'; then
  cat >&2 <<'REASON'
Refused: dev and main are never pushed to, the release included.

Open a pull request against dev and merge it with "Rebase and merge". A deployment
is a pull request from dev to main, merged the same way, and the tag that follows
is what publishes.

The rules are in CLAUDE.md, under Branches, and in .claude/skills/release.
REASON
  exit 2
fi

exit 0
