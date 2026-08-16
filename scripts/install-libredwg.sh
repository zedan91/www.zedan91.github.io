#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$ROOT/.azobss-libredwg"
BIN="$PREFIX/bin/dxf2dwg"
VERSION="0.14.8531"
ARCHIVE="libredwg-${VERSION}.tar.gz"
URL="https://github.com/LibreDWG/libredwg/releases/download/${VERSION}/${ARCHIVE}"
SHA256="930b2a7caf829fcde32ea40e202d4e5b56e48b482b6db4f7d2295b0342708427"
WORK="${TMPDIR:-/tmp}/azobss-libredwg-${VERSION}"
STATUS_DIR="$PREFIX"
STATUS_FILE="$STATUS_DIR/install-status.log"

mkdir -p "$STATUS_DIR"
: > "$STATUS_FILE"
log(){ printf '[AZOBSS LibreDWG] %s\n' "$*" | tee -a "$STATUS_FILE"; }

if [[ "${AZOBSS_DISABLE_LIBREDWG:-0}" == "1" ]]; then
  log "Disabled by AZOBSS_DISABLE_LIBREDWG=1; DXF remains available."
  exit 0
fi

if [[ -x "$BIN" ]]; then
  if "$BIN" --version >/dev/null 2>&1 || "$BIN" --help >/dev/null 2>&1; then
    log "dxf2dwg already installed and executable: $BIN"
    exit 0
  fi
  log "Existing dxf2dwg failed self-check; rebuilding."
  rm -f "$BIN"
fi

missing=0
for cmd in curl tar make gcc sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Required build tool '$cmd' is unavailable."
    missing=1
  fi
done
if [[ "$missing" == "1" ]]; then
  log "LibreDWG cannot be built in this environment. DXF remains available."
  exit 0
fi

rm -rf "$WORK"
mkdir -p "$WORK" "$PREFIX" "$PREFIX/bin"
cd "$WORK" || exit 0

log "Downloading LibreDWG ${VERSION} source from official GitHub release..."
if ! curl -fL --retry 4 --retry-all-errors --connect-timeout 20 --max-time 240 "$URL" -o "$ARCHIVE" 2>>"$STATUS_FILE"; then
  log "Download failed. DXF remains available."
  exit 0
fi

actual_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ "$actual_sha" != "$SHA256" ]]; then
  log "Checksum mismatch. Refusing unverified source."
  exit 0
fi

if ! tar -xzf "$ARCHIVE" >>"$STATUS_FILE" 2>&1; then
  log "Could not extract LibreDWG source."
  exit 0
fi

SRC="$WORK/libredwg-${VERSION}"
if [[ ! -x "$SRC/configure" ]]; then
  log "configure script not found in release source."
  exit 0
fi

cd "$SRC" || exit 0
log "Configuring local LibreDWG build (write enabled, docs/bindings/shared disabled, Werror disabled)..."
if ! env CFLAGS="${CFLAGS:-} -O2 -Wno-error" ./configure \
    --prefix="$PREFIX" \
    --enable-write \
    --disable-werror \
    --disable-bindings \
    --disable-docs \
    --disable-shared >>"$STATUS_FILE" 2>&1; then
  log "Configure failed. See $STATUS_FILE"
  exit 0
fi

JOBS="${AZOBSS_LIBREDWG_BUILD_JOBS:-2}"
log "Compiling LibreDWG (jobs=${JOBS})..."
if ! make -j"$JOBS" >>"$STATUS_FILE" 2>&1; then
  log "Parallel compile failed; retrying single-threaded."
  if ! make -j1 >>"$STATUS_FILE" 2>&1; then
    log "Compile failed. See $STATUS_FILE"
    exit 0
  fi
fi

if ! make install >>"$STATUS_FILE" 2>&1; then
  log "make install failed; trying direct dxf2dwg binary copy."
fi

# Some builds finish the utility but fail an unrelated install target. Preserve the
# working converter instead of losing DWG support.
if [[ ! -x "$BIN" ]]; then
  for candidate in "$SRC/programs/dxf2dwg" "$SRC/dxf2dwg"; do
    if [[ -x "$candidate" ]]; then
      cp "$candidate" "$BIN"
      chmod +x "$BIN"
      log "Copied built dxf2dwg directly from $candidate"
      break
    fi
  done
fi

if [[ -x "$BIN" ]] && ("$BIN" --version >/dev/null 2>&1 || "$BIN" --help >/dev/null 2>&1); then
  log "Installed successfully: $BIN"
  rm -rf "$WORK"
  exit 0
fi

log "Build completed but a usable dxf2dwg was not produced. DXF remains available. See $STATUS_FILE"
exit 0
