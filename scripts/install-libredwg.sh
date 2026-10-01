#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$ROOT/.azobss-libredwg"
BIN="$PREFIX/bin/dxf2dwg"
REWRITE_BIN="$PREFIX/bin/dwgrewrite"
VERSION="0.14.8580"
ARCHIVE="libredwg-${VERSION}.tar.gz"
URL="https://github.com/LibreDWG/libredwg/releases/download/${VERSION}/${ARCHIVE}"
SHA256=""
FALLBACK_VERSION="0.14.8531"
FALLBACK_SHA256="930b2a7caf829fcde32ea40e202d4e5b56e48b482b6db4f7d2295b0342708427"
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

if [[ -x "$BIN" && -x "$REWRITE_BIN" ]]; then
  if ("$BIN" --version >/dev/null 2>&1 || "$BIN" --help >/dev/null 2>&1) \
     && ("$REWRITE_BIN" --version >/dev/null 2>&1 || "$REWRITE_BIN" --help >/dev/null 2>&1); then
    log "dxf2dwg + dwgrewrite already installed and executable."
    exit 0
  fi
  log "Existing LibreDWG utilities failed self-check; rebuilding."
  rm -f "$BIN" "$REWRITE_BIN"
fi

missing=0
for cmd in curl tar make gcc sha256sum autoconf automake libtoolize m4; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Required build tool '$cmd' is unavailable."
    missing=1
  fi
done
if [[ "$missing" == "1" ]]; then
  log "LibreDWG cannot be built in this environment. DXF remains available."
  exit 0
fi

# Debian/Ubuntu's libtool package reliably provides `libtoolize`. A generic
# /usr/bin/libtool executable is not required here: ./configure generates the
# project-local libtool wrapper used by make. v935 incorrectly required
# `command -v libtool`, which caused Docker builds to stop even though the
# libtool package was already installed.
log "Build tool preflight OK (libtoolize=$(command -v libtoolize))."

rm -rf "$WORK"
mkdir -p "$WORK" "$PREFIX" "$PREFIX/bin"
cd "$WORK" || exit 0

log "Downloading LibreDWG ${VERSION} source from official GitHub release..."
if ! curl -fL --retry 4 --retry-all-errors --connect-timeout 20 --max-time 240 "$URL" -o "$ARCHIVE" 2>>"$STATUS_FILE"; then
  log "Download failed. DXF remains available."
  exit 0
fi

# GitHub release assets expose a sha256 digest via the official Releases API.
# Prefer the newest pinned release, but never compile an unverified archive.
if [[ -z "$SHA256" ]]; then
  RELEASE_META="$WORK/release-${VERSION}.json"
  if curl -fsSL --retry 3 --connect-timeout 15 --max-time 60 \
      "https://api.github.com/repos/LibreDWG/libredwg/releases/tags/${VERSION}" \
      -o "$RELEASE_META" 2>>"$STATUS_FILE"; then
    SHA256="$(node - "$RELEASE_META" "$ARCHIVE" <<'NODE'
const fs = require('fs');
const meta = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const name = process.argv[3];
const asset = Array.isArray(meta.assets) ? meta.assets.find(a => a && a.name === name) : null;
const digest = asset && typeof asset.digest === 'string' ? asset.digest : '';
if (/^sha256:[0-9a-f]{64}$/i.test(digest)) process.stdout.write(digest.slice(7).toLowerCase());
NODE
)"
  fi
fi

actual_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ -z "$SHA256" || "$actual_sha" != "$SHA256" ]]; then
  log "Latest release digest unavailable/mismatched; falling back to verified LibreDWG ${FALLBACK_VERSION}."
  VERSION="$FALLBACK_VERSION"
  ARCHIVE="libredwg-${VERSION}.tar.gz"
  URL="https://github.com/LibreDWG/libredwg/releases/download/${VERSION}/${ARCHIVE}"
  SHA256="$FALLBACK_SHA256"
  WORK="${TMPDIR:-/tmp}/azobss-libredwg-${VERSION}"
  rm -rf "$WORK"
  mkdir -p "$WORK" "$PREFIX" "$PREFIX/bin"
  cd "$WORK" || exit 0
  if ! curl -fL --retry 4 --retry-all-errors --connect-timeout 20 --max-time 240 "$URL" -o "$ARCHIVE" 2>>"$STATUS_FILE"; then
    log "Fallback download failed. DXF remains available."
    exit 0
  fi
  actual_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  if [[ "$actual_sha" != "$SHA256" ]]; then
    log "Fallback checksum mismatch. Refusing unverified source."
    exit 0
  fi
fi
log "Verified LibreDWG ${VERSION} archive sha256=${actual_sha}."

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
log "Configuring local LibreDWG build (write enabled; Python/bindings/docs/shared disabled; Werror disabled)..."
if ! env CFLAGS="${CFLAGS:-} -O2 -Wno-error" ./configure \
    --prefix="$PREFIX" \
    --disable-werror \
    --disable-python \
    --disable-bindings \
    --disable-docs \
    --disable-shared >>"$STATUS_FILE" 2>&1; then
  log "Configure failed. See $STATUS_FILE"
  exit 0
fi

JOBS="${AZOBSS_LIBREDWG_BUILD_JOBS:-1}"
log "Compiling LibreDWG (jobs=${JOBS})..."
if ! make -j"$JOBS" >>"$STATUS_FILE" 2>&1; then
  log "Parallel compile failed; retrying single-threaded."
  if ! make -j1 >>"$STATUS_FILE" 2>&1; then
    log "Compile failed. See $STATUS_FILE"
    exit 0
  fi
fi

if ! make install >>"$STATUS_FILE" 2>&1; then
  log "make install failed; trying direct utility binary copy."
fi

# Some builds finish the utilities but fail an unrelated install target. Preserve
# the working binaries instead of losing DWG support.
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
if [[ ! -x "$REWRITE_BIN" ]]; then
  for candidate in "$SRC/programs/dwgrewrite" "$SRC/dwgrewrite"; do
    if [[ -x "$candidate" ]]; then
      cp "$candidate" "$REWRITE_BIN"
      chmod +x "$REWRITE_BIN"
      log "Copied built dwgrewrite directly from $candidate"
      break
    fi
  done
fi

if [[ -x "$BIN" && -x "$REWRITE_BIN" ]] \
   && ("$BIN" --version >/dev/null 2>&1 || "$BIN" --help >/dev/null 2>&1) \
   && ("$REWRITE_BIN" --version >/dev/null 2>&1 || "$REWRITE_BIN" --help >/dev/null 2>&1); then
  log "Installed successfully: $BIN + $REWRITE_BIN"
  rm -rf "$WORK"
  exit 0
fi

log "Build completed but dxf2dwg/dwgrewrite pair was not usable. DXF remains available. Last build log lines:"
tail -n 80 "$STATUS_FILE" 2>/dev/null || true
exit 0
