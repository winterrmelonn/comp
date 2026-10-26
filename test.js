const assert = require('assert');
const { totalHours, toCSV } = require('./app.js');

assert.strictEqual(totalHours([]), 0);
assert.strictEqual(totalHours([{ hours: 1.1 }, { hours: '2.2' }]), 3.3);
assert.strictEqual(
  toCSV([{ date: '2026-10-01', org: 'Food "Bank", OC', hours: 2 }]),
  'date,org,activity,hours,supervisor,contact\n"2026-10-01","Food ""Bank"", OC","","2","",""'
);
const { daysUntil, deadlineText, sortTracked, trackSummary, safeUrl, toICS, calendarLinks, csvOf, parseICS, nextDue, dueText, filterCatalog, sortCatalog } = require('./track.js');

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
const links = calendarLinks({ name: 'Coke & Co', deadline: '2026-12-31', org: 'Foundation' });
assert.ok(links.google.includes('dates=20261231%2F20270101'));
assert.ok(links.google.includes('text=Coke+%26+Co+deadline'));
assert.ok(links.outlook.includes('startdt=2026-12-31') && links.outlook.includes('enddt=2027-01-01'));
assert.strictEqual(csvOf([{ Name: 'A "B"', Amount: 5 }]), '"Name","Amount"\n"A ""B""","5"');
assert.strictEqual(csvOf([]), '');
assert.deepStrictEqual(parseICS([
  'BEGIN:VCALENDAR', 'X-WR-CALNAME:Canvas',
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261102', 'SUMMARY:Essay draft\\, v2', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/Los_Angeles:20261105T235900', 'SUMMARY:Lab report that is very lon', ' g', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:no date', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')), [{ date: '2026-11-02', title: 'Essay draft, v2' }, { date: '2026-11-05', title: 'Lab report that is very long' }]);
const T = '2026-10-26';
const cat = [
  { name: 'Elks', kind: 'scholarship', deadline: '2026-11-12', verified: true, grades: [12], fields: ['general'], basis: 'both', region: 'National', amount: 30000, summary: 'seniors' },
  { name: 'COSMOS', kind: 'program', dueMonth: 2, verified: false, grades: [9, 10, 11, 12], fields: ['stem'], cost: 'aid', region: 'California', summary: 'UC summer' },
  { name: 'Coca-Cola', kind: 'scholarship', dueMonth: 9, verified: false, grades: [12], fields: ['leadership'], basis: 'merit', region: 'National', amount: 20000, summary: '' },
  { name: 'Hack Club', kind: 'program', rolling: true, verified: false, grades: [9, 10, 11, 12], fields: ['cs'], cost: 'free', region: 'National', summary: 'coders' },
  { name: 'Old', kind: 'scholarship', deadline: '2026-10-01', verified: true, grades: [12], fields: [], region: 'National', summary: '' },
  { name: 'Now', kind: 'program', dueMonth: 10, verified: false, grades: [11], fields: [], cost: 'free', region: 'National', summary: '' },
];
assert.deepStrictEqual(nextDue(cat[1], T), { date: '2027-02-15', exact: false });
assert.deepStrictEqual(nextDue(cat[2], T), { date: '2027-09-15', exact: false });
assert.deepStrictEqual(nextDue(cat[5], T), { date: '2027-10-15', exact: false }); // late in its month
assert.deepStrictEqual(nextDue(cat[5], '2026-10-05'), { date: '2026-10-05', exact: false });
assert.strictEqual(dueText(cat[5], T), 'Usually due in October, so likely closed this year');
assert.strictEqual(dueText(cat[5], '2026-10-05'), 'Usually due this month: check now');
assert.strictEqual(nextDue(cat[3], T), null);
assert.strictEqual(dueText(cat[1], T), 'Usually due in February');
assert.strictEqual(dueText(cat[3], T), 'Rolling: apply anytime');
assert.strictEqual(dueText(cat[4], T), 'Closed for this year');
const names = r => r.map(i => i.name);
assert.deepStrictEqual(names(filterCatalog(cat, {}, T)), ['Elks', 'COSMOS', 'Coca-Cola', 'Hack Club', 'Now']); // closed hidden
assert.deepStrictEqual(names(filterCatalog(cat, { q: 'CODERS' }, T)), ['Hack Club']);
assert.deepStrictEqual(names(filterCatalog(cat, { grade: '11', kind: 'program' }, T)), ['COSMOS', 'Hack Club', 'Now']);
assert.deepStrictEqual(names(filterCatalog(cat, { due: 'month' }, T)), ['Elks']);
assert.deepStrictEqual(names(filterCatalog(cat, { free: true, kind: 'program' }, T)), ['Hack Club', 'Now']);
assert.deepStrictEqual(names(filterCatalog(cat, { region: 'California' }, T)), ['COSMOS']);
assert.deepStrictEqual(names(sortCatalog(filterCatalog(cat, {}, T), 'deadline', T)), ['Elks', 'COSMOS', 'Coca-Cola', 'Now', 'Hack Club']);
assert.deepStrictEqual(names(sortCatalog(filterCatalog(cat, {}, T), 'amount', T)).slice(0, 2), ['Elks', 'Coca-Cola']);
// the real catalog is well-formed
const catalog = JSON.parse(require('fs').readFileSync(__dirname + '/data/catalog.json', 'utf8')).items;
for (const i of catalog) {
  assert.ok(i.id && i.name && i.org && i.summary && ['scholarship', 'program'].includes(i.kind), i.id);
  assert.ok(safeUrl(i.url)?.startsWith('https://'), i.id);
  assert.ok(Array.isArray(i.grades) && i.grades.length && Array.isArray(i.fields) && i.fields.length, i.id);
  assert.ok(!i.verified || i.deadline, `${i.id}: verified items need an exact deadline`);
  assert.ok(i.deadline || i.dueMonth || 'rolling' in i, i.id);
}
assert.strictEqual(new Set(catalog.map(i => i.id)).size, catalog.length);
console.log('ok');
