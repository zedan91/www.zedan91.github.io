#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFIX="$ROOT/.azobss-libredwg"
BIN="$PREFIX/bin/dxf2dwg"
VERSION="0.14.8531"
ARCHIVE="libredwg-${VERSION}.tar.gz"
URL="https://github.com/LibreDWG/libredwg/releases/download/${VERSION}/${ARCHIVE}"
SHA256="930b2a7caf829fcde32ea40e202d4e5b56e48b482b6db4f7d2295b0342708427"
WORK="${TMPDIR:-/tmp}/azobss-libredwg-${VERSION}"

log(){ printf '[AZOBSS LibreDWG] %s\n' "$*"; }

if [[ "${AZOBSS_DISABLE_LIBREDWG:-0}" == "1" ]]; then
  log "Disabled by AZOBSS_DISABLE_LIBREDWG=1; DXF will remain available."
  exit 0
fi

if [[ -x "$BIN" ]]; then
  log "dxf2dwg already installed: $BIN"
  exit 0
fi

for cmd in curl tar make gcc sha256sum; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Build tool '$cmd' is unavailable. Skipping DWG helper; DXF remains available."
    exit 0
  fi
done

rm -rf "$WORK"
mkdir -p "$WORK" "$PREFIX"
cd "$WORK"

log "Downloading LibreDWG ${VERSION} source..."
if ! curl -fL --retry 3 --connect-timeout 20 --max-time 180 "$URL" -o "$ARCHIVE"; then
  log "Download failed. Skipping DWG helper; DXF remains available."
  exit 0
fi

actual_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ "$actual_sha" != "$SHA256" ]]; then
  log "Checksum mismatch. Refusing to compile unverified source."
  exit 0
fi

if ! tar -xzf "$ARCHIVE"; then
  log "Could not extract source archive."
  exit 0
fi

SRC="$WORK/libredwg-${VERSION}"
if [[ ! -x "$SRC/configure" ]]; then
  log "configure script not found in release source."
  exit 0
fi

cd "$SRC"
log "Configuring local dxf2dwg build..."
if ! ./configure --prefix="$PREFIX" --disable-bindings --disable-docs --disable-shared >/tmp/azobss-libredwg-configure.log 2>&1; then
  log "Configure failed. See /tmp/azobss-libredwg-configure.log during build. DXF remains available."
  exit 0
fi

JOBS="${AZOBSS_LIBREDWG_BUILD_JOBS:-2}"
log "Compiling (jobs=${JOBS})..."
if ! make -j"$JOBS" >/tmp/azobss-libredwg-make.log 2>&1; then
  log "Compile failed. See /tmp/azobss-libredwg-make.log during build. DXF remains available."
  exit 0
fi

if ! make install >/tmp/azobss-libredwg-install.log 2>&1; then
  log "Install failed. DXF remains available."
  exit 0
fi

if [[ -x "$BIN" ]]; then
  log "Installed successfully: $BIN"
else
  log "Build completed but dxf2dwg was not found. DXF remains available."
fi

rm -rf "$WORK"
exit 0
