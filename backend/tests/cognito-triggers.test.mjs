// ทดสอบ Lambda triggers ของ Cognito โดยไม่เรียก TU API จริง (mock fetch)
// รัน: node --test backend/tests/cognito-triggers.test.mjs
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { handler as define } from '../cognito-triggers/define-auth-challenge/index.mjs';
import { handler as create } from '../cognito-triggers/create-auth-challenge/index.mjs';
import { handler as verify, setAttributeWriterForTests, tuLoginName, verifyWithTu } from '../cognito-triggers/verify-auth-challenge/index.mjs';
import { handler as preSignUp } from '../cognito-triggers/pre-sign-up/index.mjs';
import { curriculumFor, qualificationChecks, studyYear } from '../src/config/coopCriteria.js';

const realFetch = globalThis.fetch;
const written = [];
setAttributeWriterForTests(async (event, attributes) => { written.push({ user: event.userName, attributes }); });
afterEach(() => { globalThis.fetch = realFetch; delete process.env.TU_API_KEY; delete process.env.MOCK_LOGINS; delete process.env.MOCK_PASSWORD; written.length = 0; });

const defineEvent = (session, userNotFound = false) => ({ request: { session, userNotFound }, response: {} });
const verifyEvent = (userName, challengeAnswer, userAttributes = {}) => ({ userName, userPoolId: 'us-east-1_Test', request: { challengeAnswer, userAttributes }, response: {} });
function mockTu(status, body) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); };
  return calls;
}

test('define: one TU password challenge, tokens only after a correct answer', async () => {
  assert.equal((await define(defineEvent([]))).response.challengeName, 'CUSTOM_CHALLENGE');
  const ok = (await define(defineEvent([{ challengeName: 'CUSTOM_CHALLENGE', challengeResult: true }]))).response;
  assert.equal(ok.issueTokens, true); assert.equal(ok.failAuthentication, false);
  const wrong = (await define(defineEvent([{ challengeName: 'CUSTOM_CHALLENGE', challengeResult: false }]))).response;
  assert.equal(wrong.issueTokens, false); assert.equal(wrong.failAuthentication, true);
  // ห้ามเดาซ้ำใน session เดิม และห้ามข้าม challenge
  const retry = [{ challengeName: 'CUSTOM_CHALLENGE', challengeResult: false }, { challengeName: 'CUSTOM_CHALLENGE', challengeResult: true }];
  assert.equal((await define(defineEvent(retry))).response.issueTokens, false);
  assert.equal((await define(defineEvent([{ challengeName: 'SRP_A', challengeResult: true }]))).response.issueTokens, false);
  assert.equal((await define(defineEvent([], true))).response.failAuthentication, true);
});

test('create: exposes no secret to the client', async () => {
  const { response } = await create({ request: { challengeName: 'CUSTOM_CHALLENGE' }, response: {} });
  assert.deepEqual(response.publicChallengeParameters, { type: 'TU_PASSWORD' });
  assert.deepEqual(response.privateChallengeParameters, {});
});

test('verify: accepts only a TU success for the same username', async () => {
  process.env.TU_API_KEY = 'test-key';
  const calls = mockTu(200, { status: true, username: '6609611111', type: 'student' });
  assert.equal((await verify(verifyEvent('6609611111', 'secret'))).response.answerCorrect, true);
  assert.equal(calls[0].init.headers['Application-Key'], 'test-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), { UserName: '6609611111', PassWord: 'secret' });

  mockTu(200, { status: true, username: 'someone.else' });
  assert.equal((await verify(verifyEvent('6609611111', 'secret'))).response.answerCorrect, false);
  mockTu(400, { status: false, message: 'Password incorrect' });
  assert.equal((await verify(verifyEvent('6609611111', 'wrong'))).response.answerCorrect, false);
  const none = mockTu(200, { status: true, username: '6609611111' });
  assert.equal((await verify(verifyEvent('6609611111', ''))).response.answerCorrect, false);
  assert.equal(none.length, 0, 'empty password is rejected without calling TU');
});

test('verify: CS students of any year and TU staff pass; other majors and mismatched usernames do not', async () => {
  process.env.TU_API_KEY = 'test-key';
  for (const id of ['5909611111', '6109651111', '7009611111', 'somchai.j']) {
    mockTu(200, { status: true, username: id, type: /^\d/.test(id) ? 'student' : 'employee' });
    assert.equal((await verify(verifyEvent(id, 'secret'))).response.answerCorrect, true, id);
  }
  // Cognito username กลายเป็นตัวตนใน token จึงต้องตรงกับที่ TU ยืนยัน
  mockTu(200, { status: true, username: '6609611111', type: 'student' });
  assert.equal((await verify(verifyEvent('somchai', 'secret'))).response.answerCorrect, false);
  for (const id of ['6609621111', '0000000000']) {
    const calls = mockTu(200, { status: true, username: id });
    assert.equal((await verify(verifyEvent(id, 'secret'))).response.answerCorrect, false, id);
    assert.equal(calls.length, 0, `${id} is rejected without calling TU`);
  }
});

test('verifyWithTu returns the identity TU confirmed and maps university emails to a TU login name', async () => {
  process.env.TU_API_KEY = 'test-key';
  mockTu(200, { status: true, username: '6609611111', type: 'student', displayname_th: 'สมชาย ใจดี', displayname_en: 'Somchai Jaidee', email: 'somchai.jai@dome.tu.ac.th' });
  assert.deepEqual(await verifyWithTu('somchai.jai', 'secret'), { username: '6609611111', type: 'student', th_name: 'สมชาย ใจดี', en_name: 'Somchai Jaidee', email: 'somchai.jai@dome.tu.ac.th' });
  mockTu(200, { status: true, username: 'Advisor.A' });
  assert.deepEqual(await verifyWithTu('advisor.a', 'secret'), { username: 'advisor.a', type: 'employee', th_name: 'advisor.a', en_name: 'advisor.a', email: null });
  assert.equal(tuLoginName(' Somchai.Jai@DOME.tu.ac.th '), 'somchai.jai');
  assert.equal(tuLoginName('advisor.a@tu.ac.th'), 'advisor.a');
  assert.equal(tuLoginName('6609611111'), '6609611111');
  assert.equal(tuLoginName('company@example.test'), null);
  assert.equal(tuLoginName('a b@tu.ac.th'), null);
});

test('verify: TU outage or missing key fails loudly instead of "wrong password"', async () => {
  mockTu(200, { status: true, username: '6609611111' });
  await assert.rejects(verify(verifyEvent('6609611111', 'secret')));
  process.env.TU_API_KEY = 'test-key';
  mockTu(503, {});
  await assert.rejects(verify(verifyEvent('6609611111', 'secret')));
  // คำตอบจริงของ TU เมื่อ Application-Key ผิด
  mockTu(403, { status: false, error: 'Authentication failed due to the following reason: invalid token. Confirm that the access token in the authorization header is valid.' });
  await assert.rejects(verifyWithTu('6609611111', 'secret'), { name: 'TuKeyError' });
});

test('pre sign-up: auto-confirms TU-shaped usernames, passes Google through', async () => {
  const tu = await preSignUp({ triggerSource: 'PreSignUp_SignUp', userName: '6609611111', response: {} });
  assert.equal(tu.response.autoConfirmUser, true);
  await assert.rejects(preSignUp({ triggerSource: 'PreSignUp_SignUp', userName: 'Bad User!', response: {} }));
  const google = await preSignUp({ triggerSource: 'PreSignUp_ExternalProvider', userName: 'google_123', response: {} });
  assert.equal(google.response.autoConfirmUser, undefined);
});

test('curriculum by entry year and coop eligibility from year 3', () => {
  assert.equal(curriculumFor('6109611111'), '61');
  assert.equal(curriculumFor('6509651111'), '61');
  assert.equal(curriculumFor('6609611111'), '66');
  assert.equal(curriculumFor('6909611111'), '66');
  assert.equal(curriculumFor('v3.staff'), null);
  // ปีการศึกษา 2569 เริ่ม ส.ค. 2026: รหัส 67 = ปี 3, รหัส 68 = ปี 2
  const term2569 = new Date(2026, 9, 19);
  assert.equal(studyYear('6709611111', term2569), 3);
  assert.equal(studyYear('6809611111', term2569), 2);
  assert.equal(studyYear('6709611111', new Date(2026, 6, 31)), 2, 'before August is still academic year 2568');
  const failed = (username, curriculum) => qualificationChecks({ username, curriculum }).filter(([ok]) => !ok).map(([, label]) => label);
  assert.ok(failed('6909611111', '66').some((label) => label.includes('ชั้นปีที่ 3')));
  assert.ok(failed('6109611111', '66').some((label) => label.includes('หลักสูตร 61')));
  assert.ok(!failed('6109611111', '61').some((label) => label.includes('หลักสูตร') || label.includes('ชั้นปี')));
});

test('verify: saves the TU name/email of a CS student into Cognito once, never blocks login on failure', async () => {
  process.env.TU_API_KEY = 'test-key';
  const tu = { status: true, type: 'student', username: '6609611111', displayname_th: 'สมชาย ใจดี', displayname_en: 'Somchai Jaidee', email: 'somchai.jai@dome.tu.ac.th' };
  mockTu(200, tu);
  assert.equal((await verify(verifyEvent('6609611111', 'secret'))).response.answerCorrect, true);
  assert.deepEqual(written, [{ user: '6609611111', attributes: [
    { Name: 'name', Value: 'สมชาย ใจดี' }, { Name: 'custom:en_name', Value: 'Somchai Jaidee' },
    { Name: 'email', Value: 'somchai.jai@dome.tu.ac.th' }, { Name: 'email_verified', Value: 'true' },
  ] }]);
  written.length = 0;
  mockTu(200, tu);
  const saved = { name: 'สมชาย ใจดี', 'custom:en_name': 'Somchai Jaidee', email: 'somchai.jai@dome.tu.ac.th', email_verified: 'true' };
  await verify(verifyEvent('6609611111', 'secret', saved));
  assert.equal(written.length, 0, 'unchanged attributes are not rewritten');
  mockTu(200, { status: true, type: 'employee', username: 'somchai.j' });
  await verify(verifyEvent('somchai.j', 'secret'));
  assert.equal(written.length, 0, 'staff profiles are not stored');

  setAttributeWriterForTests(async () => { throw Object.assign(new Error('denied'), { name: 'AccessDeniedException' }); });
  try {
    mockTu(200, tu);
    assert.equal((await verify(verifyEvent('6609611111', 'secret'))).response.answerCorrect, true);
  } finally {
    setAttributeWriterForTests(async (event, attributes) => { written.push({ user: event.userName, attributes }); });
  }
});

test('verify: mock accounts listed in MOCK_LOGINS use MOCK_PASSWORD and never reach TU', async () => {
  process.env.TU_API_KEY = 'test-key';
  process.env.MOCK_LOGINS = 'staff.v3@tu.ac.th, Company.V3@example.test';
  process.env.MOCK_PASSWORD = 'mock-secret';
  const calls = mockTu(200, { status: true, username: 'staff.v3@tu.ac.th' });
  assert.equal((await verify(verifyEvent('staff.v3@tu.ac.th', 'mock-secret'))).response.answerCorrect, true);
  assert.equal((await verify(verifyEvent('company.v3@example.test', 'mock-secret'))).response.answerCorrect, true);
  assert.equal((await verify(verifyEvent('staff.v3@tu.ac.th', 'wrong'))).response.answerCorrect, false);
  assert.equal(calls.length, 0);
  delete process.env.MOCK_PASSWORD;
  assert.equal((await verify(verifyEvent('staff.v3@tu.ac.th', 'mock-secret'))).response.answerCorrect, false, 'no password configured = no mock login');
  assert.equal((await preSignUp({ triggerSource: 'PreSignUp_SignUp', userName: 'staff.v3@tu.ac.th', response: {} })).response.autoConfirmUser, true);
});

test('S3 storage writes without overwriting and maps a missing object to null', async () => {
  const { getFile, putFile, setS3ForTests } = await import('../src/services/storage.js');
  const sent = [];
  class Command { constructor(input) { this.input = input; } }
  const commands = { PutObjectCommand: class extends Command {}, GetObjectCommand: class extends Command {} };
  setS3ForTests({ send: async (command) => {
    sent.push(command);
    if (command instanceof commands.GetObjectCommand) {
      if (command.input.Key === 'missing.pdf') throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
      return { Body: { transformToByteArray: async () => new Uint8Array([37, 80, 68, 70]) } };
    }
    return {};
  } }, commands);
  process.env.FILE_BUCKET = 'coop-files';
  try {
    await putFile('12/transcript-x.pdf', Buffer.from('%PDF'), 'application/pdf');
    assert.deepEqual(sent[0].input, { Bucket: 'coop-files', Key: '12/transcript-x.pdf', Body: Buffer.from('%PDF'), ContentType: 'application/pdf', IfNoneMatch: '*' });
    assert.equal((await getFile('12/transcript-x.pdf')).toString(), '%PDF');
    assert.equal(await getFile('missing.pdf'), null);
  } finally {
    delete process.env.FILE_BUCKET;
  }
});
