#!/bin/bash
# The actual command the LaunchAgent (com.meridian.healthos) executes.
# Not meant to be run directly by a person — use `npm run local:start`
# instead. Kept as its own script (rather than inlining `next start` into
# the plist) so it can do a pre-flight check and print a clear, one-line
# reason to the log file when the service can't start, instead of a bare
# Next.js stack trace repeating every ThrottleInterval seconds.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f ".next/BUILD_ID" ]; then
  echo "[meridian] No production build found (.next/BUILD_ID missing)."
  echo "[meridian] Run 'npm run build' (or 'npm run local:update') from $(pwd), then 'npm run local:start'."
  exit 1
fi

# Binds 0.0.0.0 (all interfaces) — required for LAN/iPhone reachability
# (Section 3). This is still local-network-only: nothing here opens a port
# on the router or exposes Meridian to the public internet.
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
