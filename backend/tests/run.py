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
    sql(name, 'ALTER TABLE users DROP COLUMN is_supervisor;')
    # 006 re-adds is_supervisor with the old advisor CHECK; 010 must replace it.
    sql(name, 'ALTER TABLE students DROP COLUMN profile_status, DROP COLUMN profile_comment, DROP COLUMN profile_reviewed_by, '
              'DROP COLUMN profile_reviewed_at, DROP COLUMN conduct_status, DROP COLUMN conduct_comment, DROP COLUMN conduct_reviewed_by, DROP COLUMN conduct_reviewed_at;')
    review_migration = (ROOT / 'database/migrations/006_student_review.sql').read_text()
    sql(name, review_migration)
    sql(name, review_migration)
    sql(name, 'ALTER TABLE companies DROP COLUMN allowance, DROP COLUMN additional_info, DROP COLUMN additional_file;')
    company_migration = (ROOT / 'database/migrations/007_company_allowance.sql').read_text()
    sql(name, company_migration)
    sql(name, company_migration)
    sql(name, 'ALTER TABLE students DROP COLUMN cv_s3_key, DROP COLUMN photo_s3_key, DROP COLUMN address, DROP COLUMN major, '
              'DROP COLUMN guardian_name, DROP COLUMN guardian_relation, DROP COLUMN guardian_address, DROP COLUMN guardian_phone;')
    student_profile_migration = (ROOT / 'database/migrations/008_student_profile.sql').read_text()
    sql(name, student_profile_migration)
    sql(name, student_profile_migration)
    sql(name, 'ALTER TABLE students DROP COLUMN coop_result, DROP COLUMN coop_result_by, DROP COLUMN coop_result_at;')
    coop_result_migration = (ROOT / 'database/migrations/009_coop_result.sql').read_text()
    sql(name, coop_result_migration)
    sql(name, coop_result_migration)
    sql(name, 'ALTER TABLE students DROP COLUMN screening_status, DROP COLUMN screening_note, DROP COLUMN screening_by, DROP COLUMN screening_at, '
              'DROP COLUMN committee_result, DROP COLUMN committee_by, DROP COLUMN committee_at;')
    committee_migration = (ROOT / 'database/migrations/010_committee.sql').read_text()
    sql(name, committee_migration)
    sql(name, committee_migration)
    sql(name, 'ALTER TABLE applications DROP COLUMN company_note, DROP COLUMN company_file;')
    feedback_migration = (ROOT / 'database/migrations/011_company_feedback.sql').read_text()
    sql(name, feedback_migration)
    sql(name, feedback_migration)
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
