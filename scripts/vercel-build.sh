#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/frontend"
npm ci
npm run build

mkdir -p "$ROOT/backend/app/static"
cp -r dist/* "$ROOT/backend/app/static/"
