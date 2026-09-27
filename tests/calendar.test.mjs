import test from 'node:test';
import assert from 'node:assert/strict';
import { onDay, jstDay, eventTime } from '../web/calendar.js';
test('JST midnight conversion',()=>assert.equal(jstDay('2026-10-11T15:00:00Z'),'2026-10-12'));
test('All-day end is exclusive',()=>{
 const event={start:{date:'2026-10-12'},end:{date:'2026-10-14'}};
 assert.equal(onDay(event,'2026-10-12'),true);assert.equal(onDay(event,'2026-10-13'),true);assert.equal(onDay(event,'2026-10-14'),false);
});
test('Timed event spanning midnight is present on both days',()=>{
 const event={start:{dateTime:'2026-10-12T23:00:00+09:00'},end:{dateTime:'2026-10-13T01:00:00+09:00'}};
 assert.equal(onDay(event,'2026-10-12'),true);assert.equal(onDay(event,'2026-10-13'),true);assert.equal(onDay(event,'2026-10-14'),false);
});
test('Midnight end does not occupy next day',()=>{
 const event={start:{dateTime:'2026-10-12T23:00:00+09:00'},end:{dateTime:'2026-10-13T00:00:00+09:00'}};
 assert.equal(onDay(event,'2026-10-13'),false);assert.equal(eventTime({start:{date:'2026-10-12'}}),'終日');
});
