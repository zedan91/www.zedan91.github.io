# AZOBSS backend v937
# Docker runtime provides the OS toolchain required by LibreDWG/dxf2dwg.
FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=10000

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      tar \
      xz-utils \
      make \
      gcc \
      g++ \
      libc6-dev \
      autoconf \
      automake \
      libtool \
      libtool-bin \
      m4 \
      pkg-config \
      perl \
      gzip \
      zlib1g-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .npmrc ./
COPY scripts/install-libredwg.sh ./scripts/install-libredwg.sh
RUN chmod +x ./scripts/install-libredwg.sh \
 && npm install --omit=dev --no-audit --no-fund

COPY . .

# Build the converter and verify it with a deliberately lean R2000 smoke DXF.
# v935/v936 used a full ezdxf document as the smoke input; LibreDWG can reject
# optional CLASSES/OBJECTS even when its converter binary itself is healthy.
RUN bash -lc 'set -euo pipefail; \
  chmod +x ./scripts/install-libredwg.sh; \
  ./scripts/install-libredwg.sh; \
  if [ ! -x /app/.azobss-libredwg/bin/dxf2dwg ]; then \
    echo "[AZOBSS Docker] dxf2dwg binary was not produced."; \
    cat /app/.azobss-libredwg/install-status.log || true; \
    exit 1; \
  fi; \
  (/app/.azobss-libredwg/bin/dxf2dwg --version || /app/.azobss-libredwg/bin/dxf2dwg --help) >/tmp/azobss-dxf2dwg-version.log 2>&1; \
  echo "[AZOBSS Docker] dxf2dwg executable self-check passed."; \
  if ! /app/.azobss-libredwg/bin/dxf2dwg -v0 -y --as r2000 -o /tmp/azobss-dwg-smoke.dwg /app/scripts/dwg-smoke-test.dxf >/tmp/azobss-dwg-smoke.log 2>&1; then \
    echo "[AZOBSS Docker] DXF->DWG smoke conversion failed:"; \
    cat /tmp/azobss-dwg-smoke.log || true; \
    cat /app/.azobss-libredwg/install-status.log || true; \
    exit 1; \
  fi; \
  test -s /tmp/azobss-dwg-smoke.dwg; \
  sig="$(head -c 6 /tmp/azobss-dwg-smoke.dwg)"; \
  echo "[AZOBSS Docker] smoke DWG signature=${sig}"; \
  echo "$sig" | grep -Eq "^AC10[0-9][0-9]$"; \
  rm -f /tmp/azobss-dwg-smoke.dwg /tmp/azobss-dwg-smoke.log /tmp/azobss-dxf2dwg-version.log'

ENV AZOBSS_DXF2DWG_PATH=/app/.azobss-libredwg/bin/dxf2dwg \
    AZOBSS_LIBREDWG_BUILD_JOBS=1

EXPOSE 10000
CMD ["node", "deploy-server.js"]
