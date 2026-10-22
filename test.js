const assert = require('assert');
const { totalHours, toCSV } = require('./app.js');

assert.strictEqual(totalHours([]), 0);
assert.strictEqual(totalHours([{ hours: 1.1 }, { hours: '2.2' }]), 3.3);
assert.strictEqual(
  toCSV([{ date: '2026-10-01', org: 'Food "Bank", OC', hours: 2 }]),
  'date,org,activity,hours,supervisor,contact\n"2026-10-01","Food ""Bank"", OC","","2","",""'
);
console.log('ok');
