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

// UI: one script for every page; each block only runs if its page elements exist
if (typeof document === 'object') (async () => {
  const KEY = 'comp';
  const GOAL = 160; // FVHS community service cord
  const FIELDS = ['date', 'org', 'activity', 'hours', 'supervisor', 'contact'];
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const say = text => { if ($('msg')) $('msg').textContent = text; else alert(text); };

  // Two clicks instead of confirm(), which some browsers block
  const confirmClick = (btn, action) => {
    const label = btn.textContent;
    btn.onclick = async () => {
      if (btn.textContent === label) {
        btn.textContent = 'Sure?';
        setTimeout(() => { btn.textContent = label; }, 3000);
        return;
      }
      btn.disabled = true;
      try { await action(); } catch (err) { say(`Something went wrong: ${err.message}`); btn.disabled = false; }
    };
  };

  // Guest data stays in this browser
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch {}
  state ||= { entries: [] };
  state.entries.forEach(e => { e.id ||= newId(); });
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { alert("Couldn't save in this browser. Download the CSV so you don't lose your hours."); }
  };
  const sortAndSave = () => {
    state.entries.sort((a, b) => b.date.localeCompare(a.date));
    save();
  };

  // Logged in: data lives in Supabase (tables in supabase.sql)
  const user = sb ? (await sb.auth.getSession()).data.session?.user : null;
  const check = ({ data, error }) => { if (error) throw error; return data; };

  const hours = {
    list: async () => user ? check(await sb.from('hours').select().order('date', { ascending: false })) : state.entries,
    get: async id => user ? check(await sb.from('hours').select().eq('id', id).maybeSingle()) : state.entries.find(e => e.id === id),
    async add(rows) {
      if (user) return check(await sb.from('hours').insert(rows.map(({ id, ...row }) => row)));
      state.entries.push(...rows.map(row => ({ ...row, id: newId() })));
      sortAndSave();
    },
    async update(id, row) {
      if (user) return check(await sb.from('hours').update(row).eq('id', id));
      Object.assign(state.entries.find(e => e.id === id), row);
      sortAndSave();
    },
    async remove(id) {
      if (user) return check(await sb.from('hours').delete().eq('id', id));
      state.entries = state.entries.filter(e => e.id !== id);
      save();
    },
  };

  const blankProfile = { name: '', school: '', clubs: [] };
  const loadProfile = async () => (user && check(await sb.from('profiles').select().eq('id', user.id).maybeSingle())) || blankProfile;
  const myClubs = async () => user ? check(await sb.from('clubs').select().eq('leader_id', user.id).order('name')) : [];

  // Pages that need an account hide their form for guests
  const requireLogin = form => {
    if (user) return true;
    form.hidden = true;
    $('msg').textContent = 'You need an account for this. ';
    $('msg').append(el('a', { href: 'login.html', textContent: 'Log in' }));
    return false;
  };

  const who = $('who');
  if (who) {
    who.textContent = user ? `Logged in as ${user.email}. ` : 'Guest: everything is saved on this device only. ';
    who.append(el('a', { href: 'login.html', textContent: user ? 'Log out' : 'Log in' }));
  }

  // log.html (also edits an entry with ?edit=<id>)
  const form = $('form');
  if (form) {
    let editId = new URLSearchParams(location.search).get('edit');
    const entries = await hours.list().catch(() => []);
    $('orgs').replaceChildren(...[...new Set(entries.map(e => e.org))].map(o => new Option(o)));
    form.date.value = today();
    form.date.max = today();

    const entry = editId && await hours.get(editId).catch(() => null);
    if (entry) {
      for (const k of FIELDS) form[k].value = entry[k] ?? '';
      $('title').textContent = 'Edit hours';
      form.querySelector('button').textContent = 'Save changes';
    } else {
      editId = null;
    }

    form.onsubmit = async ev => {
      ev.preventDefault();
      const row = Object.fromEntries(new FormData(form));
      row.hours = Number(row.hours);
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        if (editId) {
          await hours.update(editId, row);
          location.href = 'profile.html';
          return;
        }
        await hours.add([row]);
        form.reset();
        form.date.value = today();
        $('msg').textContent = 'Saved. ';
        $('msg').append(el('a', { href: 'profile.html', textContent: 'See your hours' }));
      } catch (err) {
        say(`Couldn't save: ${err.message}`);
      }
      btn.disabled = false;
    };
  }

  // profile.html
  if ($('rows')) {
    let entries = [];

    const rowFor = e => {
      const tr = el('tr');
      const supervisor = [e.supervisor, e.contact].filter(Boolean).join(' · ');
      for (const text of [e.date, e.org, e.activity, e.hours, supervisor]) tr.insertCell().textContent = text;
      tr.insertCell().className = 'print-only';
      const actions = tr.insertCell();
      actions.className = 'no-print actions';
      const del = el('button', { textContent: 'Delete', className: 'secondary' });
      confirmClick(del, async () => { await hours.remove(e.id); await refresh(); });
      actions.append(el('a', { href: `log.html?edit=${encodeURIComponent(e.id)}`, textContent: 'Edit', className: 'button secondary' }), del);
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
      try { entries = await hours.list(); } catch (err) { say(`Couldn't load your hours: ${err.message}`); }
      render();
    };

    const [profile, leads] = await Promise.all([loadProfile(), myClubs()]).catch(err => {
      say(`Couldn't load your profile: ${err.message}`);
      return [blankProfile, []];
    });
    $('p-name').textContent = profile.name || (user ? 'Add your name' : 'Guest');
    $('p-school').textContent = profile.school || '';
    $('p-clubs').replaceChildren(
      ...leads.map(c => el('li', { textContent: `${c.name} · Leader` })),
      ...profile.clubs.map(name => el('li', { textContent: name })),
    );

    // Hours logged as a guest on this device can be moved into the account
    if (user && state.entries.length) {
      const btn = $('import');
      btn.hidden = false;
      btn.textContent = `Add ${state.entries.length} entries from this device to your account`;
      btn.onclick = async () => {
        try {
          await hours.add(state.entries);
          state.entries = [];
          save();
          btn.hidden = true;
        } catch (err) {
          say(`Couldn't move them: ${err.message}`);
        }
        refresh();
      };
    }

    $('csv').onclick = () => {
      const a = el('a', { href: URL.createObjectURL(new Blob([toCSV(entries)], { type: 'text/csv' })), download: 'volunteer-hours.csv' });
      a.click();
    };

    $('print').onclick = () => print();
    await refresh();
    document.body.classList.remove('loading');
  }

  // edit-profile.html
  const profileForm = $('profile-form');
  if (profileForm && requireLogin(profileForm)) {
    const f = profileForm.elements;
    const p = await loadProfile().catch(() => blankProfile);
    f.name.value = p.name ?? '';
    f.school.value = p.school ?? '';
    f.clubs.value = p.clubs.join(', ');
    profileForm.onsubmit = async ev => {
      ev.preventDefault();
      const clubs = f.clubs.value.split(',').map(s => s.trim()).filter(Boolean);
      try {
        check(await sb.from('profiles').upsert({ id: user.id, name: f.name.value.trim(), school: f.school.value.trim(), clubs }));
        location.href = 'profile.html';
      } catch (err) {
        say(`Couldn't save: ${err.message}`);
      }
    };
  }

  // club.html
  const clubForm = $('club-form');
  if (clubForm && requireLogin(clubForm)) {
    const showMine = async () => {
      const clubs = await myClubs();
      $('my-clubs').replaceChildren(...clubs.map(c => el('li', { textContent: c.name })));
      $('my-clubs-section').hidden = !clubs.length;
    };
    clubForm.onsubmit = async ev => {
      ev.preventDefault();
      const club = Object.fromEntries(new FormData(clubForm));
      try {
        check(await sb.from('clubs').insert(club));
        clubForm.reset();
        $('msg').textContent = `${club.name} is registered. `;
        $('msg').append(el('a', { href: 'find.html', textContent: 'Post an opportunity' }));
        await showMine();
      } catch (err) {
        say(`Couldn't register: ${err.message}`);
      }
    };
    await showMine().catch(() => {});
  }

  // find.html
  if ($('posts')) {
    const postFor = p => {
      const card = el('article', { className: 'post' });
      const when = new Date(`${p.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      card.append(
        el('p', { className: 'label', textContent: [when, p.time].filter(Boolean).join(' · ') }),
        el('h2', { textContent: p.title }),
        el('p', { className: 'muted', textContent: [p.clubs?.name, p.location].filter(Boolean).join(' · ') }),
      );
      if (p.details) card.append(el('p', { textContent: p.details }));
      if (p.clubs?.contact) card.append(el('p', { className: 'muted', textContent: `Contact: ${p.clubs.contact}` }));
      card.append(el('a', { href: `programs.html?from=${encodeURIComponent(p.id)}`, textContent: 'Track this', className: 'button secondary' }));
      if (user && p.author_id === user.id) {
        const del = el('button', { textContent: 'Delete', className: 'secondary' });
        confirmClick(del, async () => { check(await sb.from('posts').delete().eq('id', p.id)); await showPosts(); });
        card.append(del);
      }
      return card;
    };

    const showPosts = async () => {
      let posts = [];
      try {
        posts = check(await sb.from('posts').select('*, clubs(name, contact)').gte('date', today()).order('date'));
      } catch (err) {
        say(`Couldn't load opportunities: ${err.message}`);
      }
      $('posts').replaceChildren(...posts.map(postFor));
      $('empty').hidden = posts.length > 0;
    };

    // Club leaders get a form to post for their clubs
    const clubs = await myClubs().catch(() => []);
    if (clubs.length) {
      const f = $('post-form');
      $('post-section').hidden = false;
      $('leader-hint').hidden = true;
      f.club_id.replaceChildren(...clubs.map(c => new Option(c.name, c.id)));
      f.date.min = today();
      f.onsubmit = async ev => {
        ev.preventDefault();
        try {
          check(await sb.from('posts').insert(Object.fromEntries(new FormData(f))));
          f.reset();
          say('Posted.');
          await showPosts();
        } catch (err) {
          say(`Couldn't post: ${err.message}`);
        }
      };
    }

    if (sb) await showPosts();
    else say("Couldn't connect. Check your internet connection.");
  }
})();
