import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function verifyLine(raw: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const eventSchema = z.object({
  status: z.enum(['event', 'needs_review', 'no_event']),
  title: z.string().max(120),
  start: z.string(), end: z.string(), location: z.string().max(200),
  reason: z.string().max(300)
}).strict();
export type Extracted = z.infer<typeof eventSchema>;
export const jsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['event', 'needs_review', 'no_event'] },
    title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
    location: { type: 'string' }, reason: { type: 'string' }
  }, required: ['status', 'title', 'start', 'end', 'location', 'reason']
};
function validJst(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time + 9 * 3600_000).toISOString().slice(0, 19) === value.slice(0, 19);
}
export function validateExtraction(input: unknown, reference: number): Extracted {
  const result = eventSchema.parse(input);
  if (result.status !== 'event') return result;
  const start = Date.parse(result.start), end = Date.parse(result.end);
  if (!result.title.trim() || !validJst(result.start) || !validJst(result.end) ||
      end <= start || end - start > 7 * 86400_000 || start < reference || start > reference + 366 * 86400_000) {
    return { ...result, status: 'needs_review', reason: '日時が不正、過去、または対応範囲外です。' };
  }
  return result;
}
