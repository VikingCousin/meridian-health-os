#!/bin/bash
# Manages the Meridian LaunchAgent — the permanent, production-mode,
# auto-starting local service (Section 4 of the V1 launch setup). Wired up
# as `npm run local:<command>`; see README "Running Meridian permanently on
# your Mac" for the full picture.
#
# Subcommands: install | start | stop | restart | status | update | uninstall
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.meridian.healthos"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$PROJECT_ROOT/data/logs"
OUT_LOG="$LOG_DIR/meridian.out.log"
ERR_LOG="$LOG_DIR/meridian.err.log"
PORT=3000
UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"
NODE_BIN="$(command -v node || true)"

cmd="${1:-}"

require_installed() {
  if [ ! -f "$PLIST_PATH" ]; then
    echo "Meridian isn't installed as a LaunchAgent yet. Run: npm run local:install"
    exit 1
  fi
}

# launchd can briefly fail a bootstrap with "Input/output error" if it runs
# immediately after a bootout of the same label (the previous job's
# resources haven't fully released yet) — retrying after a short pause
# resolves it without needing to involve the user.
bootstrap_with_retry() {
  local attempt=1
  while ! launchctl bootstrap "$DOMAIN" "$PLIST_PATH" 2>/tmp/meridian-bootstrap-err; do
    if [ "$attempt" -ge 5 ]; then
      cat /tmp/meridian-bootstrap-err >&2
      rm -f /tmp/meridian-bootstrap-err
      return 1
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  rm -f /tmp/meridian-bootstrap-err
}

do_install() {
  if [ -z "$NODE_BIN" ]; then
    echo "Could not find 'node' on PATH. Install Node.js first, then re-run this."
    exit 1
  fi
  mkdir -p "$LOG_DIR"
  mkdir -p "$HOME/Library/LaunchAgents"

  cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${PROJECT_ROOT}/scripts/local-run.sh</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>15</integer>
    <key>StandardOutPath</key>
    <string>${OUT_LOG}</string>
    <key>StandardErrorPath</key>
    <string>${ERR_LOG}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:$(dirname "$NODE_BIN")</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
PLIST

  echo "Wrote $PLIST_PATH"

  # Bootstrap: registers + starts (RunAtLoad) immediately. If it's already
  # bootstrapped from a previous install, bootout first so this is idempotent.
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  bootstrap_with_retry
  echo "Installed and started. It will now also start automatically every time you log into this Mac."
}

do_start() {
  require_installed
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    launchctl kickstart -k "$DOMAIN/$LABEL"
  else
    bootstrap_with_retry
  fi
  echo "Started. Checking..."
  sleep 1
  do_status
}

do_stop() {
  require_installed
  # bootout fully unloads the job, so KeepAlive can't immediately relaunch it
  # — this is a real stop, not just killing the current process.
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || echo "(already stopped)"
  echo "Stopped. It will stay stopped until 'npm run local:start' or your next login."
}

do_restart() {
  require_installed
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  bootstrap_with_retry
  sleep 1
  do_status
}

do_status() {
  if [ ! -f "$PLIST_PATH" ]; then
    echo "Not installed. Run: npm run local:install"
    exit 1
  fi

  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    pid="$(launchctl print "$DOMAIN/$LABEL" 2>/dev/null | awk '/pid = /{print $3; exit}')"
    if [ -n "${pid:-}" ]; then
      echo "launchd: loaded, pid $pid"
    else
      echo "launchd: loaded, not currently running (will retry — see logs)"
    fi
  else
    echo "launchd: not loaded (stopped)"
  fi

  # curl already prints "000" via -w on a failed connection, so no || fallback is needed
  # (adding one would double it up to "000000").
  http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:${PORT}/" 2>/dev/null)" || true
  if [ "$http_code" = "200" ]; then
    echo "http: responding (200) at http://localhost:${PORT}"
  else
    echo "http: not responding (got '$http_code') — check logs at $ERR_LOG"
  fi
}

do_update() {
  echo "Building..."
  (cd "$PROJECT_ROOT" && npm run build)
  echo "Build succeeded. Restarting service..."
  # Only reached if `npm run build` exited 0 — `set -e` stops this script
  # before restarting if the build fails, so a broken build never replaces
  # a working, already-running Meridian.
  if [ -f "$PLIST_PATH" ]; then
    do_restart
  else
    echo "Not installed yet — run: npm run local:install"
  fi
}

do_uninstall() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST_PATH"
  echo "Removed the LaunchAgent. Your database and uploads are untouched."
}

case "$cmd" in
  install) do_install ;;
  start) do_start ;;
  stop) do_stop ;;
  restart) do_restart ;;
  status) do_status ;;
  update) do_update ;;
  uninstall) do_uninstall ;;
  *)
    echo "Usage: $0 {install|start|stop|restart|status|update|uninstall}"
    exit 1
    ;;
esac
