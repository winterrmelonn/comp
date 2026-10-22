// Pure logic (tested in test.js)
function totalHours(entries) {
  return Math.round(entries.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;
}

function toCSV(entries) {
  const cols = ['date', 'org', 'activity', 'hours', 'supervisor', 'contact'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...entries.map(e => cols.map(c => esc(e[c])).join(','))].join('\n');
}

if (typeof module === 'object') module.exports = { totalHours, toCSV };

// UI
if (typeof document === 'object') {
  const KEY = 'servelog';
  const $ = id => document.getElementById(id);
  const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch {}
  state ||= { name: '', school: '', goal: 40, entries: [] };

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { alert("Couldn't save in this browser. Download the CSV so you don't lose your hours."); }
  };

  function rowFor(e) {
    const tr = document.createElement('tr');
    const supervisor = [e.supervisor, e.contact].filter(Boolean).join(' · ');
    for (const text of [e.date, e.org, e.activity, e.hours, supervisor]) tr.insertCell().textContent = text;
    tr.insertCell().className = 'print-only';
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'secondary';
    del.onclick = () => {
      if (!confirm(`Delete ${e.hours} hours at ${e.org}?`)) return;
      state.entries = state.entries.filter(x => x !== e);
      save();
      render();
    };
    const cell = tr.insertCell();
    cell.className = 'no-print';
    cell.append(del);
    return tr;
  }

  function render() {
    const total = totalHours(state.entries);
    const left = Math.round((state.goal - total) * 100) / 100;
    $('total').textContent = total;
    $('goal-out').textContent = state.goal;
    $('bar').max = state.goal;
    $('bar').value = total;
    $('left').textContent = left > 0 ? `${left} hours to go` : 'Goal reached! 🎉';
    $('rows').replaceChildren(...state.entries.map(rowFor));
    $('empty').hidden = state.entries.length > 0;
    $('orgs').replaceChildren(...[...new Set(state.entries.map(e => e.org))].map(o => new Option(o)));
  }

  for (const id of ['name', 'school', 'goal']) {
    $(id).value = state[id];
    $(id).oninput = () => {
      const v = $(id).value;
      if (id !== 'goal') state[id] = v;
      else if (Number(v) > 0) state.goal = Number(v);
      save();
      render();
    };
  }

  $('form').onsubmit = ev => {
    ev.preventDefault();
    const entry = Object.fromEntries(new FormData(ev.target));
    entry.hours = Number(entry.hours);
    state.entries.push(entry);
    state.entries.sort((a, b) => b.date.localeCompare(a.date));
    save();
    render();
    ev.target.reset();
    ev.target.date.value = today();
  };

  $('csv').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCSV(state.entries)], { type: 'text/csv' }));
    a.download = 'volunteer-hours.csv';
    a.click();
  };

  $('print').onclick = () => print();
  $('form').date.value = today();
  render();
}
