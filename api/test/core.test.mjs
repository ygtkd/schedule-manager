import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyLine, validateExtraction, hash } from '../dist/core.js';
const reference = Date.parse('2026-09-27T00:00:00+09:00');
const valid = { status: 'event', title: '打ち合わせ', start: '2026-10-15T14:00:00+09:00', end: '2026-10-15T15:00:00+09:00', location: '渋谷', reason: '' };
test('LINE signature rejects altered bytes and missing signatures', () => {
  const raw = '{"events":[]}', secret = 'test-secret';
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  assert.equal(verifyLine(raw, signature, secret), true);
  assert.equal(verifyLine(raw + ' ', signature, secret), false);
  assert.equal(verifyLine(raw, '', secret), false);
});
test('accepts an explicit valid interval', () => assert.equal(validateExtraction(valid, reference).status, 'event'));
test('rejects impossible calendar dates, inverted intervals, wrong zones and past dates', () => {
  for (const change of [ { start: '2027-02-30T14:00:00+09:00', end: '2027-03-02T15:00:00+09:00' }, { end: valid.start }, { start: '2026-10-15T14:00:00Z' }, { start: '2026-09-01T14:00:00+09:00', end: '2026-09-01T15:00:00+09:00' } ]) {
    assert.equal(validateExtraction({ ...valid, ...change }, reference).status, 'needs_review');
  }
});
test('unknown fields and missing fields cannot pass schema validation', () => {
  assert.throws(() => validateExtraction({ ...valid, command: 'execute' }, reference));
  assert.throws(() => validateExtraction({ status: 'event' }, reference));
});
test('review is never promoted and calendar IDs are deterministic', () => {
  assert.equal(validateExtraction({ ...valid, status: 'needs_review' }, reference).status, 'needs_review');
  assert.equal(hash('line-event-123'), hash('line-event-123'));
  assert.match(hash('line-event-123'), /^[0-9a-f]{64}$/);
});
