#!/usr/bin/env python3
"""One real-PostgreSQL integration suite. Never runs tests on the application DB."""
from pathlib import Path
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[2]
# Each Docker build has its own context; verify the pure rules used by both stay identical.
assert (ROOT / 'frontend/src/config/coopCriteria.js').read_bytes() == (ROOT / 'backend/src/config/coopCriteria.js').read_bytes(), 'Frontend/backend eligibility rules differ'
name = 'cs361_api_test_' + uuid.uuid4().hex[:12]


def sql(database, statement):
    subprocess.run(['docker', 'compose', 'exec', '-T', 'database', 'sh', '-c',
                    'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"', 'sh', database],
                   input='SET client_min_messages=warning;\n' + statement, text=True, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)


sql('postgres', f'CREATE DATABASE {name};')
try:
    sql(name, (ROOT / 'database/init/001_schema.sql').read_text())
    # Exercise rerunnable migration on V3 as well as API operations below.
    sql(name, (ROOT / 'database/migrations/003_v3_schema.sql').read_text())
    # Simulate the prior V3 schema, then verify the additive upgrade is rerunnable.
    sql(name, 'ALTER TABLE students DROP COLUMN curriculum, DROP COLUMN course_grades, DROP COLUMN declarations;')
    course_migration = (ROOT / 'database/migrations/004_student_course_grades.sql').read_text()
    sql(name, course_migration)
    sql(name, course_migration)
    seed = (ROOT / 'database/seeds/005_v3-demo.sql').read_text()
    sql(name, seed)
    sql(name, seed)
    subprocess.run(['docker', 'compose', 'exec', '-T', '-e', f'DB_NAME={name}',
                    '-e', 'AUTH_MODE=development', '-e', 'NODE_ENV=test',
                    '-e', 'DB_POOL_MAX=8',
                    '-e', 'DEV_AUTH_PASSWORD=V3-test-only!', '-e', f'UPLOAD_DIR=/tmp/.{name}_uploads',
                    'backend', 'node', '--test', 'tests/api.test.mjs'], cwd=ROOT, check=True)
finally:
    sql('postgres', f'DROP DATABASE {name} WITH (FORCE);')
