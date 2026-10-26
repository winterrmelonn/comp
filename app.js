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

  // Photos (accounts only) go to the private "photos" bucket under the student's own folder
  const photos = sb && sb.storage.from('photos');
  const shrink = async file => { // phone photos are huge; resize to 1600px JPEG, or keep the original if the browser can't read it
    try {
      const img = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = el('canvas', { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    } catch {
      return file;
    }
  };
  const uploadPhoto = async file => {
    const blob = await shrink(file);
    const path = `${user.id}/${newId()}.jpg`;
    check(await photos.upload(path, blob, { contentType: blob.type }));
    return path;
  };
  const removePhoto = path => path && photos.remove([path]).catch(() => {});
  const photoUrls = async rows => { // path -> link that works for an hour
    const paths = rows.map(r => r.photo).filter(Boolean);
    if (!user || !paths.length) return {};
    const { data } = await photos.createSignedUrls(paths, 3600);
    return Object.fromEntries((data || []).filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
  };

  const blankProfile = { name: '', school: '', instagram: '', memberships: [] };
  const loadProfile = async () => ({ ...blankProfile, ...(user && check(await sb.from('profiles').select().eq('id', user.id).maybeSingle())) });
  const TERMS = ['Freshman', 'Sophomore', 'Junior', 'Senior'].flatMap(g => [`Semester 1 ${g}`, `Semester 2 ${g}`]);
  // Accepts @handle or a pasted instagram.com link
  const igHandle = v => v.trim().replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?].*$/, '');
  const validHandle = h => /^[A-Za-z0-9._]{1,30}$/.test(h);
  const IG_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
    + '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>';
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

    const preview = $('photo-preview');
    const showPreview = src => { preview.src = src || ''; preview.hidden = !src; };
    $('photo-field').hidden = !user;
    form.photo.onchange = () => showPreview(form.photo.files[0] && URL.createObjectURL(form.photo.files[0]));

    const entry = editId && await hours.get(editId).catch(() => null);
    if (entry) {
      for (const k of FIELDS) form[k].value = entry[k] ?? '';
      $('title').textContent = 'Edit hours';
      form.querySelector('button').textContent = 'Save changes';
      if (entry.photo) showPreview((await photoUrls([entry]))[entry.photo]);
    } else {
      editId = null;
    }

    form.onsubmit = async ev => {
      ev.preventDefault();
      const { photo, ...row } = Object.fromEntries(new FormData(form));
      row.hours = Number(row.hours);
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        if (user && photo?.size) {
          say('Uploading photo…');
          row.photo = await uploadPhoto(photo);
        }
        if (editId) {
          await hours.update(editId, row);
          if (row.photo) await removePhoto(entry.photo); // replaced
          location.href = 'profile.html';
          return;
        }
        await hours.add([row]);
        form.reset();
        form.date.value = today();
        showPreview(null);
        $('msg').textContent = 'Saved. ';
        $('msg').append(el('a', { href: 'profile.html', textContent: 'See your hours' }));
      } catch (err) {
        if (row.photo) await removePhoto(row.photo); // don't leave the upload behind if the entry didn't save
        say(`Couldn't save: ${err.message}`);
      }
      btn.disabled = false;
    };
  }

  // profile.html
  if ($('rows')) {
    let entries = [];
    let urls = {};

    const rowFor = e => {
      const tr = el('tr');
      const thumb = tr.insertCell();
      thumb.className = 'no-print';
      if (urls[e.photo]) {
        const link = el('a', { href: urls[e.photo], target: '_blank', rel: 'noopener' });
        link.append(el('img', { src: urls[e.photo], alt: `Photo from ${e.org}`, className: 'thumb', loading: 'lazy' }));
        thumb.append(link);
      }
      const supervisor = [e.supervisor, e.contact].filter(Boolean).join(' · ');
      const cells = [e.date, e.org, e.activity, e.hours, supervisor].map(text => Object.assign(tr.insertCell(), { textContent: text }));
      if (e.verified_at) cells[4].append(el('span', { className: 'verified', textContent: `✓ Signed off by ${e.verified_by}` }));
      tr.insertCell().className = 'print-only';
      if (e.verified_at) tr.lastChild.textContent = `Signed off online by ${e.verified_by}, ${new Date(e.verified_at).toLocaleDateString()}`;
      const actions = tr.insertCell();
      actions.className = 'no-print actions';
      if (user && !e.verified_at) {
        const ask = el('button', { textContent: e.verify_token ? 'Resend sign-off' : 'Get signed off', className: 'secondary' });
        ask.onclick = async () => {
          try { await sendSignoff(e); } catch (err) { say(`Couldn't make a sign-off link: ${err.message}`); }
          ask.textContent = 'Resend sign-off';
        };
        actions.append(ask);
      }
      const del = el('button', { textContent: 'Delete', className: 'secondary' });
      confirmClick(del, async () => {
        await hours.remove(e.id);
        await removePhoto(e.photo);
        await refresh();
      });
      actions.append(el('a', { href: `log.html?edit=${encodeURIComponent(e.id)}`, textContent: 'Edit', className: 'button secondary' }), del);
      return tr;
    };

    // Supervisor sign-off (accounts only): a secret link the supervisor opens without an account (verify.html)
    const sendSignoff = async e => {
      if (!e.verify_token) {
        const token = crypto.randomUUID();
        check(await sb.from('hours').update({ verify_token: token }).eq('id', e.id));
        e.verify_token = token;
      }
      const url = new URL(`verify.html?t=${e.verify_token}`, location.href).href;
      const text = `Hi${e.supervisor ? ` ${e.supervisor}` : ''}, could you sign off my ${Number(e.hours)} volunteer hours at ${e.org} on ${e.date}? It takes a few seconds and no account is needed: ${url}`;
      if (navigator.share) {
        try { return await navigator.share({ title: 'Sign off volunteer hours', text }); } catch (err) { if (err.name === 'AbortError') return; }
      }
      if (/@/.test(e.contact || '')) open(`mailto:${encodeURIComponent(e.contact)}?subject=${encodeURIComponent('Sign off volunteer hours')}&body=${encodeURIComponent(text)}`, '_self');
      try {
        await navigator.clipboard.writeText(text);
        say('Sign-off message copied. Send it to your supervisor.');
      } catch {
        prompt('Send this to your supervisor:', text);
      }
    };

    const render = () => {
      const total = totalHours(entries);
      const left = Math.round((GOAL - total) * 100) / 100;
      $('total').textContent = total;
      $('goal-out').textContent = GOAL;
      $('bar').max = GOAL;
      $('bar').value = total;
      $('left').textContent = left > 0 ? `${left} hours to go` : 'Goal reached! 🎉';
      const signed = totalHours(entries.filter(e => e.verified_at));
      $('signed').textContent = user && total ? `${signed} of ${total} hours signed off by supervisors` : '';
      $('rows').replaceChildren(...entries.map(rowFor));
      $('empty').hidden = entries.length > 0;
    };

    const refresh = async () => {
      try {
        entries = await hours.list();
        urls = await photoUrls(entries);
      } catch (err) {
        say(`Couldn't load your hours: ${err.message}`);
      }
      render();
    };

    const [profile, leads] = await Promise.all([loadProfile(), myClubs()]).catch(err => {
      say(`Couldn't load your profile: ${err.message}`);
      return [blankProfile, []];
    });
    $('p-name').textContent = profile.name || (user ? 'Add your name' : 'Guest');
    $('p-school').textContent = profile.school || '';
    $('p-leads').textContent = leads.length ? `Club leader · ${leads.map(c => c.name).join(', ')}` : '';
    if (validHandle(profile.instagram || '')) {
      const link = el('a', { href: `https://www.instagram.com/${profile.instagram}/`, target: '_blank', rel: 'noopener' });
      link.innerHTML = IG_ICON;
      link.append(`@${profile.instagram}`);
      $('p-insta').replaceChildren(link);
    }
    $('p-clubs').replaceChildren(...profile.memberships.map(m => {
      const li = el('li');
      li.append(
        el('span', { className: 'club', textContent: m.club }),
        el('span', { className: 'when', textContent: `${m.start} – ${m.end}` }),
        el('span', { className: 'role', textContent: m.role }),
      );
      return li;
    }));
    $('p-clubs-section').hidden = !profile.memberships.length;

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
    f.instagram.value = p.instagram ? `@${p.instagram}` : '';

    // One row per club: club, role, from, to
    const KEYS = ['club', 'role', 'start', 'end'];
    const addRow = (m = {}) => {
      const row = $('membership-row').content.firstElementChild.cloneNode(true);
      const [club, role, start, end] = KEYS.map(k => row.querySelector(`[data-k="${k}"]`));
      start.append(...TERMS.map(t => new Option(t)));
      end.append(new Option('Present'), ...TERMS.map(t => new Option(t)));
      club.value = m.club ?? '';
      role.value = m.role ?? '';
      start.value = m.start ?? TERMS[0];
      end.value = m.end ?? 'Present';
      row.querySelector('.remove').onclick = () => row.remove();
      $('memberships').append(row);
    };
    (p.memberships.length ? p.memberships : [{}]).forEach(addRow);
    $('add-club').onclick = () => addRow();

    profileForm.onsubmit = async ev => {
      ev.preventDefault();
      const instagram = igHandle(f.instagram.value);
      if (instagram && !validHandle(instagram)) return say('That Instagram handle doesn\'t look right. Use letters, numbers, periods or underscores.');
      const memberships = [...$('memberships').children]
        .map(row => Object.fromEntries(KEYS.map(k => [k, row.querySelector(`[data-k="${k}"]`).value.trim()])))
        .filter(m => m.club);
      try {
        check(await sb.from('profiles').upsert({
          id: user.id, name: f.name.value.trim(), school: f.school.value.trim(), instagram: instagram || null, memberships,
        }));
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
    // Posts are volunteer events, scholarships or programs (kind added in supabase-6.sql)
    const KIND = { volunteer: 'Volunteer', scholarship: 'Scholarship', program: 'Program' };
    const kindOf = p => p.kind || 'volunteer';
    let posts = [];
    let shown = 'all';

    const postFor = p => {
      const kind = kindOf(p);
      const card = el('article', { className: 'post' });
      const when = new Date(`${p.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const label = kind === 'volunteer' ? [when, p.time] : [KIND[kind], `Due ${when}`];
      const amount = p.amount ? `$${Number(p.amount).toLocaleString()}` : null;
      card.append(
        el('p', { className: 'label', textContent: label.filter(Boolean).join(' · ') }),
        el('h2', { textContent: p.title }),
        el('p', { className: 'muted', textContent: [p.clubs?.name, p.location, amount].filter(Boolean).join(' · ') }),
      );
      if (p.details) card.append(el('p', { className: 'notes', textContent: p.details }));
      if (p.clubs?.contact) card.append(el('p', { className: 'muted', textContent: `Contact: ${p.clubs.contact}` }));

      const links = el('p', { className: 'cal-links' });
      const href = safeUrl(p.link);
      if (href) links.append(el('a', { href, target: '_blank', rel: 'noopener noreferrer', textContent: 'Open link ↗', className: 'label' }));
      const cal = calendarLinks({ name: p.title, title: kind === 'volunteer' ? p.title : undefined, deadline: p.date, org: p.clubs?.name, link: href });
      links.append(el('a', { href: cal.google, target: '_blank', rel: 'noopener noreferrer', textContent: '+ Google Calendar', className: 'label' }));
      card.append(links);

      const page = kind === 'scholarship' ? 'scholarships.html' : 'programs.html';
      card.append(el('a', { href: `${page}?from=${encodeURIComponent(p.id)}`, textContent: 'Track this', className: 'button secondary' }));
      if (user && p.author_id === user.id) {
        const del = el('button', { textContent: 'Delete', className: 'secondary' });
        confirmClick(del, async () => { check(await sb.from('posts').delete().eq('id', p.id)); await showPosts(); });
        card.append(del);
      }
      return card;
    };

    const render = () => {
      $('kind-filters').replaceChildren(...['all', ...Object.keys(KIND)].map(k => {
        const b = el('button', { className: 'chip', type: 'button', textContent: k === 'all' ? 'All' : k === 'volunteer' ? 'Volunteer' : `${KIND[k]}s` });
        b.setAttribute('aria-pressed', k === shown);
        b.onclick = () => { shown = k; render(); };
        return b;
      }));
      const q = $('find-q').value.trim().toLowerCase();
      const list = posts.filter(p => (shown === 'all' || kindOf(p) === shown)
        && (!q || [p.title, p.details, p.location, p.clubs?.name].join(' ').toLowerCase().includes(q)));
      $('posts').replaceChildren(...list.map(postFor));
      $('empty').hidden = list.length > 0;
    };

    $('find-q').oninput = () => render();

    const showPosts = async () => {
      try {
        posts = check(await sb.from('posts').select('*, clubs(name, contact)').gte('date', today()).order('date'));
      } catch (err) {
        say(`Couldn't load opportunities: ${err.message}`);
      }
      render();
    };

    // Club leaders get a form to post for their clubs
    const clubs = await myClubs().catch(() => []);
    if (clubs.length) {
      const f = $('post-form');
      $('post-section').hidden = false;
      $('leader-hint').hidden = true;
      f.club_id.replaceChildren(...clubs.map(c => new Option(c.name, c.id)));
      f.date.min = today();
      const showFields = () => {
        const k = f.kind.value;
        $('amount-field').hidden = k !== 'scholarship';
        $('time-field').hidden = $('location-field').hidden = k !== 'volunteer';
        $('date-label').firstChild.textContent = k === 'volunteer' ? 'Date ' : 'Deadline ';
      };
      f.kind.onchange = showFields;
      f.onsubmit = async ev => {
        ev.preventDefault();
        // Leave out blanks and the default kind so volunteer posts still work before supabase-6.sql is run
        const row = Object.fromEntries([...new FormData(f)].filter(([k, v]) => v !== '' && !(k === 'kind' && v === 'volunteer')));
        if (row.link) row.link = safeUrl(row.link) ?? row.link;
        try {
          check(await sb.from('posts').insert(row));
          f.reset();
          showFields();
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
