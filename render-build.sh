#!/usr/bin/env bash
set -e
npm install --include=optional
# Keep backend dependencies available too, in case Render/dashboard still installs or runs from backend paths.
if [ -f backend/package.json ]; then
  (cd backend && npm install --include=optional)
fi
