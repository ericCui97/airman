#!/usr/bin/env bash
# CLAUDE_CONFIG_DIR overrides ~/.claude, matching where the hooks write the flag.
flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.airman-active"
[ -f "$flag" ] || exit 0

mode=$(head -n1 "$flag" | tr -d '[:space:]')

if [ -z "$mode" ] || [ "$mode" = "standard" ]; then
    printf '\033[38;5;75m[AIRMAN]\033[0m'
else
    printf '\033[38;5;75m[AIRMAN:%s]\033[0m' "$(printf '%s' "$mode" | tr '[:lower:]' '[:upper:]')"
fi
