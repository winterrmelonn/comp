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
if (typeof document === 'object') (async () => {
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

  // Logged in: hours live in the Supabase "hours" table (see supabase.sql). Guest: this browser only.
  const user = sb ? (await sb.auth.getSession()).data.session?.user : null;
  const db = {
    async list() {
      if (!user) return state.entries;
      const { data, error } = await sb.from('hours').select().order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
    async add(rows) {
      if (!user) {
        state.entries.push(...rows);
        state.entries.sort((a, b) => b.date.localeCompare(a.date));
        return save();
      }
      const { error } = await sb.from('hours').insert(rows);
      if (error) throw error;
    },
    async remove(e) {
      if (!user) {
        state.entries = state.entries.filter(x => x !== e);
        return save();
      }
      const { error } = await sb.from('hours').delete().eq('id', e.id);
      if (error) throw error;
    },
  };

  const who = $('who');
  if (who) {
    who.textContent = user ? `Logged in as ${user.email}. ` : 'Guest: hours are saved on this device only. ';
    who.append(Object.assign(document.createElement('a'), { href: 'login.html', textContent: user ? 'Log out' : 'Log in' }));
  }

  // log.html
  const form = $('form');
  if (form) {
    const entries = await db.list().catch(() => []);
    $('orgs').replaceChildren(...[...new Set(entries.map(e => e.org))].map(o => new Option(o)));
    form.date.value = today();
    form.onsubmit = async ev => {
      ev.preventDefault();
      const entry = Object.fromEntries(new FormData(form));
      entry.hours = Number(entry.hours);
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        await db.add([entry]);
        form.reset();
        form.date.value = today();
        $('msg').innerHTML = 'Saved. <a href="profile.html">See your hours</a>';
      } catch (err) {
        $('msg').textContent = `Couldn't save: ${err.message}`;
      }
      btn.disabled = false;
    };
  }

  // profile.html
  if ($('rows')) {
    let entries = [];

    const rowFor = e => {
      const tr = document.createElement('tr');
      const supervisor = [e.supervisor, e.contact].filter(Boolean).join(' · ');
      for (const text of [e.date, e.org, e.activity, e.hours, supervisor]) tr.insertCell().textContent = text;
      tr.insertCell().className = 'print-only';
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'secondary';
      del.onclick = async () => {
        if (!confirm(`Delete ${e.hours} hours at ${e.org}?`)) return;
        try { await db.remove(e); } catch (err) { alert(`Couldn't delete: ${err.message}`); }
        refresh();
      };
      const cell = tr.insertCell();
      cell.className = 'no-print';
      cell.append(del);
      return tr;
    };

    const render = () => {
      const total = totalHours(entries);
      const left = Math.round((GOAL - total) * 100) / 100;
      $('total').textContent = total;
      $('goal-out').textContent = GOAL;
      $('bar').max = GOAL;
      $('bar').value = total;
      $('left').textContent = left > 0 ? `${left} hours to go` : 'Goal reached! 🎉';
      $('rows').replaceChildren(...entries.map(rowFor));
      $('empty').hidden = entries.length > 0;
    };

    const refresh = async () => {
      try { entries = await db.list(); } catch (err) { who.textContent = `Couldn't load your hours: ${err.message}`; }
      render();
    };

    for (const id of ['name', 'school']) {
      $(id).value = state[id];
      $(id).oninput = () => { state[id] = $(id).value; save(); };
    }

    // Hours logged as a guest on this device can be moved into the account
    if (user && state.entries.length) {
      const btn = $('import');
      btn.hidden = false;
      btn.textContent = `Add ${state.entries.length} entries from this device to your account`;
      btn.onclick = async () => {
        try {
          await db.add(state.entries);
          state.entries = [];
          save();
          btn.hidden = true;
        } catch (err) {
          alert(`Couldn't move them: ${err.message}`);
        }
        refresh();
      };
    }

    $('csv').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([toCSV(entries)], { type: 'text/csv' }));
      a.download = 'volunteer-hours.csv';
      a.click();
    };

    $('print').onclick = () => print();
    await refresh();
  }
})();
