const assert = require('assert');
const { totalHours, toCSV } = require('./app.js');

assert.strictEqual(totalHours([]), 0);
assert.strictEqual(totalHours([{ hours: 1.1 }, { hours: '2.2' }]), 3.3);
assert.strictEqual(
  toCSV([{ date: '2026-10-01', org: 'Food "Bank", OC', hours: 2 }]),
  'date,org,activity,hours,supervisor,contact\n"2026-10-01","Food ""Bank"", OC","","2","",""'
);
const { daysUntil, deadlineText, sortTracked, trackSummary, safeUrl, toICS } = require('./track.js');

assert.strictEqual(daysUntil('2026-11-08', '2026-10-26'), 13); // across the DST change
assert.strictEqual(deadlineText('2026-10-27', '2026-10-26'), 'Due tomorrow');
assert.strictEqual(deadlineText('2026-10-25', '2026-10-26'), 'Deadline passed');
assert.strictEqual(deadlineText(null, '2026-10-26'), 'No deadline');
assert.deepStrictEqual(
  sortTracked([
    { name: 'won', status: 'accepted', deadline: '2026-01-01' },
    { name: 'later', status: 'applying', deadline: '2026-12-01' },
    { name: 'none', status: 'interested', deadline: null },
    { name: 'sent', status: 'submitted', deadline: '2026-10-01' },
    { name: 'soon', status: 'interested', deadline: '2026-11-01' },
  ]).map(i => i.name),
  ['soon', 'later', 'none', 'sent', 'won']
);
assert.deepStrictEqual(
  trackSummary([
    { status: 'accepted', amount: '500.50' }, { status: 'accepted', amount: 1000 },
    { status: 'interested', deadline: '2026-10-30' }, { status: 'applying', deadline: '2026-10-01' },
  ], '2026-10-26'),
  { total: 4, submitted: 2, accepted: 2, won: 1500.5, nextIn: 4 }
);
assert.strictEqual(safeUrl('fastweb.com/x'), 'https://fastweb.com/x');
assert.strictEqual(safeUrl('javascript:alert(1)'), null);
assert.strictEqual(safeUrl(''), null);
const ics = toICS([
  { kind: 'scholarship', id: 1, name: 'Gates, Jr; 2026', status: 'applying', deadline: '2026-11-15' },
  { kind: 'program', id: 2, name: 'Done', status: 'accepted', deadline: '2026-11-15' },
]);
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261115'));
assert.ok(ics.includes('SUMMARY:Gates\\, Jr\\; 2026 deadline'));
assert.ok(!ics.includes('Done'));
console.log('ok');
