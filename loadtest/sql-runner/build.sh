#!/usr/bin/env bash
# สร้าง loadtest/sql-runner/build/sql-runner.zip (โค้ด + seed.sql + cleanup.sql + pg) สำหรับอัปโหลดขึ้น Lambda
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build
mkdir -p build/pkg
cp index.mjs package.json ../seed.sql ../cleanup.sql build/pkg/
(cd build/pkg && npm install --omit=dev --no-audit --no-fund --silent)
(cd build/pkg && zip -qr ../sql-runner.zip .)
echo "สร้างแล้ว: $(pwd)/build/sql-runner.zip"
