# AZOBSS backend v935
# Docker runtime is used so the DWG converter always has the OS-level build tools it needs.
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
      pkg-config \
      perl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies first for better Docker layer caching.
COPY package.json .npmrc ./
COPY scripts/install-libredwg.sh ./scripts/install-libredwg.sh
RUN chmod +x ./scripts/install-libredwg.sh \
 && npm install --omit=dev --no-audit --no-fund

COPY . .

# Build and verify the real DXF -> DWG utility while the image is being built.
# Fail the Docker build if DWG support cannot be produced; this prevents a
# seemingly-successful deploy whose DWG button can never work.
RUN chmod +x ./scripts/install-libredwg.sh \
 && ./scripts/install-libredwg.sh \
 && test -x /app/.azobss-libredwg/bin/dxf2dwg \
 && (/app/.azobss-libredwg/bin/dxf2dwg --version >/dev/null 2>&1 || /app/.azobss-libredwg/bin/dxf2dwg --help >/dev/null 2>&1) \
 && /app/.azobss-libredwg/bin/dxf2dwg -v0 -y --as r2000 -o /tmp/azobss-dwg-smoke.dwg /app/scripts/dwg-smoke-test.dxf \
 && test -s /tmp/azobss-dwg-smoke.dwg \
 && head -c 6 /tmp/azobss-dwg-smoke.dwg | grep -Eq '^AC10[0-9][0-9]$' \
 && rm -f /tmp/azobss-dwg-smoke.dwg

ENV AZOBSS_DXF2DWG_PATH=/app/.azobss-libredwg/bin/dxf2dwg

EXPOSE 10000
CMD ["node", "deploy-server.js"]
