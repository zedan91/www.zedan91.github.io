#!/usr/bin/env bash
set -e
npm install
# Chromium is installed by package.json postinstall. This fallback is safe if Render uses this build file.
npx playwright install chromium
