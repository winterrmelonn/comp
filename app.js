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

// UI: shared by log.html and profile.html; each block only runs if its page elements exist
if (typeof document === 'object') {
  const KEY = 'comp';
  const GOAL = 160; // FVHS community service cord
  const $ = id => document.getElementById(id);
  const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch {}
  state ||= { name: '', school: '', entries: [] };

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { alert("Couldn't save in this browser. Download the CSV so you don't lose your hours."); }
  };

  // log.html
  const form = $('form');
  if (form) {
    $('orgs').replaceChildren(...[...new Set(state.entries.map(e => e.org))].map(o => new Option(o)));
    form.date.value = today();
    form.onsubmit = ev => {
      ev.preventDefault();
      const entry = Object.fromEntries(new FormData(form));
      entry.hours = Number(entry.hours);
      state.entries.push(entry);
      state.entries.sort((a, b) => b.date.localeCompare(a.date));
      save();
      form.reset();
      form.date.value = today();
      $('saved').hidden = false;
    };
  }

  // profile.html
  if ($('rows')) {
    const rowFor = e => {
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
    };

    const render = () => {
      const total = totalHours(state.entries);
      const left = Math.round((GOAL - total) * 100) / 100;
      $('total').textContent = total;
      $('goal-out').textContent = GOAL;
      $('bar').max = GOAL;
      $('bar').value = total;
      $('left').textContent = left > 0 ? `${left} hours to go` : 'Goal reached! 🎉';
      $('rows').replaceChildren(...state.entries.map(rowFor));
      $('empty').hidden = state.entries.length > 0;
    };

    for (const id of ['name', 'school']) {
      $(id).value = state[id];
      $(id).oninput = () => { state[id] = $(id).value; save(); };
    }

    $('csv').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([toCSV(state.entries)], { type: 'text/csv' }));
      a.download = 'volunteer-hours.csv';
      a.click();
    };

    $('print').onclick = () => print();
    render();
  }
}
