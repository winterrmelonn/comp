// Scholarship and program tracking: scholarships.html, programs.html, and "Coming up" on home.html

// Pure logic (tested in test.js)
const DONE = ['accepted', 'rejected'];
const isActive = i => i.status === 'interested' || i.status === 'applying';

// Whole days from today to a YYYY-MM-DD date (both parsed as UTC, so DST can't skew it)
function daysUntil(date, today) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 864e5);
}

function deadlineText(date, today) {
  if (!date) return 'No deadline';
  const days = daysUntil(date, today);
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// Still to do first, then submitted, then results; soonest deadline first within each
function sortTracked(items) {
  const group = i => isActive(i) ? 0 : DONE.includes(i.status) ? 2 : 1;
  return [...items].sort((a, b) =>
    group(a) - group(b) || (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.name.localeCompare(b.name));
}

function trackSummary(items, today) {
  const won = items.filter(i => i.status === 'accepted');
  const next = sortTracked(items.filter(i => isActive(i) && i.deadline && daysUntil(i.deadline, today) >= 0))[0];
  return {
    total: items.length,
    submitted: items.filter(i => !isActive(i)).length,
    accepted: won.length,
    won: Math.round(won.reduce((sum, i) => sum + Number(i.amount || 0), 0) * 100) / 100,
    nextIn: next ? daysUntil(next.deadline, today) : null,
  };
}

// Only http(s) links become clickable; bare domains get https://
function safeUrl(link) {
  const s = String(link ?? '').trim();
  if (!s) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(s) ? s : `https://${s}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

// Calendar file with an all-day event for each open deadline
function toICS(items) {
  const esc = v => String(v ?? '').replace(/[\\;,]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//comp//deadlines//EN'];
  for (const i of items) {
    if (!i.deadline || DONE.includes(i.status)) continue;
    const day = i.deadline.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:comp-${i.kind}-${i.id}`, `DTSTAMP:${day}T000000Z`, `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${esc(`${i.name} deadline`)}`, `DESCRIPTION:${esc([i.org, i.link].filter(Boolean).join('\n'))}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

if (typeof module === 'object') module.exports = { daysUntil, deadlineText, sortTracked, trackSummary, safeUrl, toICS };

// UI
if (typeof document === 'object') (async () => {
  const KEY = 'comp-tracked';
  const FIELDS = ['name', 'org', 'amount', 'category', 'deadline', 'link', 'status', 'notes'];
  const STATUSES = ['interested', 'applying', 'submitted', 'accepted', 'rejected'];
  const KINDS = {
    scholarship: { page: 'scholarships.html', label: 'Scholarship', accepted: 'Won' },
    program: { page: 'programs.html', label: 'Program', accepted: 'Accepted' },
  };
  const statusLabel = (kind, s) => ({ interested: 'Interested', applying: 'Working on it', submitted: 'Submitted', accepted: KINDS[kind].accepted, rejected: 'Not this time' })[s];

  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const shortDate = d => new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const say = text => { if ($('msg')) $('msg').textContent = text; };

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
      try { await action(); } catch (err) { say(`Something went wrong: ${explain(err)}`); btn.disabled = false; }
    };
  };

  // Guest data stays in this browser
  let local;
  try { local = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!Array.isArray(local)) local = [];
  const saveLocal = () => {
    try { localStorage.setItem(KEY, JSON.stringify(local)); }
    catch { alert("Couldn't save in this browser. Log in to keep your list in your account."); }
  };

  // Logged in: data lives in Supabase (table in supabase-3.sql)
  const user = sb ? (await sb.auth.getSession()).data.session?.user : null;
  const check = ({ data, error }) => { if (error) throw error; return data; };
  const explain = err => err?.code === 'PGRST205' ? "tracking isn't set up for accounts yet (supabase-5.sql hasn't been run)." : err?.message;
  const clean = row => Object.fromEntries(FIELDS.filter(k => k in row).map(k => [k, row[k] === '' ? null : row[k]]));

  const tracked = {
    list: async kind => user
      ? check(await (kind ? sb.from('tracked').select().eq('kind', kind) : sb.from('tracked').select()))
      : local.filter(i => !kind || i.kind === kind),
    get: async id => user ? check(await sb.from('tracked').select().eq('id', id).maybeSingle()) : local.find(i => i.id === id),
    async add(rows) {
      if (user) return check(await sb.from('tracked').insert(rows.map(({ id, ...row }) => row)));
      local.push(...rows.map(row => ({ ...row, id: newId() })));
      saveLocal();
    },
    async update(id, row) {
      if (user) return check(await sb.from('tracked').update(row).eq('id', id));
      Object.assign(local.find(i => i.id === id), row);
      saveLocal();
    },
    async remove(id) {
      if (user) return check(await sb.from('tracked').delete().eq('id', id));
      local = local.filter(i => i.id !== id);
      saveLocal();
    },
  };

  // scholarships.html and programs.html (edit with ?edit=<id>, prefill from a Find post with ?from=<post id>)
  const kind = document.body.dataset.kind;
  const form = $('track-form');
  if (kind && form) {
    const params = new URLSearchParams(location.search);
    let editId = params.get('edit');
    let items = [];
    let filter = 'all';
    const FILTERS = { all: ['All', () => true], todo: ['To do', isActive], submitted: ['Submitted', i => i.status === 'submitted'], results: ['Results', i => DONE.includes(i.status)] };

    form.status.replaceChildren(...STATUSES.map(s => new Option(statusLabel(kind, s), s)));

    const card = i => {
      const c = el('article', { className: `post track${DONE.includes(i.status) ? ' done' : ''}` });
      const days = i.deadline ? daysUntil(i.deadline, today()) : null;
      const soon = isActive(i) && days !== null && days >= 0 && days <= 7;
      const when = isActive(i) ? deadlineText(i.deadline, today()) : statusLabel(kind, i.status);
      c.append(
        el('p', { className: `label${soon ? ' soon' : ''}`, textContent: [i.deadline && shortDate(i.deadline), when].filter(Boolean).join(' · ') }),
        el('h2', { textContent: i.name }),
      );
      const amount = i.amount ? `$${Number(i.amount).toLocaleString()}` : null;
      const meta = [i.org, kind === 'scholarship' ? amount : i.category].filter(Boolean).join(' · ');
      if (meta) c.append(el('p', { className: 'muted', textContent: meta }));
      if (i.notes) c.append(el('p', { className: 'notes', textContent: i.notes }));
      const href = safeUrl(i.link);
      if (href) {
        c.append(el('p'));
        c.lastChild.append(el('a', { href, target: '_blank', rel: 'noopener noreferrer', textContent: 'Open link ↗', className: 'label' }));
      }

      const status = el('select', { ariaLabel: 'Status' });
      status.replaceChildren(...STATUSES.map(s => new Option(statusLabel(kind, s), s, false, s === i.status)));
      status.onchange = async () => {
        try { await tracked.update(i.id, { status: status.value }); await refresh(); }
        catch (err) { say(`Couldn't update: ${explain(err)}`); }
      };
      const del = el('button', { textContent: 'Delete', className: 'secondary' });
      confirmClick(del, async () => { await tracked.remove(i.id); await refresh(); });
      const edit = el('a', { href: `?edit=${encodeURIComponent(i.id)}`, textContent: 'Edit', className: 'button secondary' });
      c.append(el('div', { className: 'row' }));
      c.lastChild.append(status, edit, del);
      return c;
    };

    const stat = (value, label) => {
      const s = el('div', { className: 'stat' });
      s.append(el('b', { textContent: value }), el('span', { textContent: label }));
      return s;
    };

    const render = () => {
      const sum = trackSummary(items, today());
      $('stats').replaceChildren(
        stat(sum.total, 'Tracking'),
        stat(sum.submitted, 'Applied'),
        kind === 'scholarship' ? stat(`$${sum.won.toLocaleString()}`, 'Won') : stat(sum.accepted, 'Accepted'),
        stat(sum.nextIn === null ? '—' : `${sum.nextIn}d`, 'Next deadline'),
      );
      $('filters').replaceChildren(...Object.entries(FILTERS).map(([key, [label]]) => {
        const b = el('button', { className: 'chip', textContent: label, type: 'button' });
        b.setAttribute('aria-pressed', key === filter);
        b.onclick = () => { filter = key; render(); };
        return b;
      }));
      const shown = sortTracked(items.filter(FILTERS[filter][1]));
      $('list').replaceChildren(...shown.map(card));
      $('track-empty').hidden = shown.length > 0;
      $('ics').hidden = !items.some(i => i.deadline && !DONE.includes(i.status));
    };

    const refresh = async () => {
      try { items = await tracked.list(kind); } catch (err) { say(`Couldn't load your list: ${explain(err)}`); }
      render();
    };

    const openForm = title => {
      $('add').open = true;
      if (title) $('form-title').textContent = title;
      form.name.focus();
    };

    const entry = editId && await tracked.get(editId).catch(() => null);
    if (entry) {
      for (const k of FIELDS) if (form[k]) form[k].value = entry[k] ?? '';
      openForm(`Edit ${entry.name}`);
      form.querySelector('button').textContent = 'Save changes';
      $('cancel').hidden = false;
    } else {
      editId = null;
    }

    // "Track this" on Find opportunities
    const from = params.get('from');
    if (from && sb && !entry) {
      try {
        const post = check(await sb.from('posts').select('*, clubs(name)').eq('id', from).maybeSingle());
        if (post) {
          form.name.value = post.title;
          form.org.value = post.clubs?.name ?? '';
          form.deadline.value = post.date;
          if (form.category) form.category.value = 'Volunteering';
          form.notes.value = [post.time, post.location, post.details].filter(Boolean).join('\n');
          openForm(`Track ${post.title}`);
          say('Filled in from Find opportunities. Save to track it.');
        }
      } catch {}
    }

    form.onsubmit = async ev => {
      ev.preventDefault();
      const row = clean(Object.fromEntries(new FormData(form)));
      if (row.amount != null) row.amount = Number(row.amount);
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        if (editId) {
          await tracked.update(editId, row);
          location.href = KINDS[kind].page;
          return;
        }
        await tracked.add([{ ...row, kind }]);
        form.reset();
        $('form-title').textContent = `+ Add a ${KINDS[kind].label.toLowerCase()}`;
        if (from) history.replaceState(null, '', KINDS[kind].page);
        say(`Saved ${row.name}.`);
        await refresh();
      } catch (err) {
        say(`Couldn't save: ${explain(err)}`);
      }
      btn.disabled = false;
    };

    $('ics').onclick = () => {
      const a = el('a', { href: URL.createObjectURL(new Blob([toICS(items)], { type: 'text/calendar' })), download: `${kind}-deadlines.ics` });
      a.click();
    };

    // Items tracked as a guest on this device can be moved into the account
    const mine = local.filter(i => i.kind === kind);
    if (user && mine.length) {
      const btn = $('track-import');
      btn.hidden = false;
      btn.textContent = `Add ${mine.length} from this device to your account`;
      btn.onclick = async () => {
        try {
          await tracked.add(mine.map(i => ({ ...clean(i), kind })));
          local = local.filter(i => i.kind !== kind);
          saveLocal();
          btn.hidden = true;
        } catch (err) {
          say(`Couldn't move them: ${explain(err)}`);
        }
        refresh();
      };
    }

    await refresh();
    if (!items.length && !entry) $('add').open = true;
    document.body.classList.remove('loading');
  }

  // home.html: next deadlines across scholarships and programs
  if ($('upcoming')) {
    const items = await tracked.list().catch(() => []);
    const soon = sortTracked(items.filter(i => isActive(i) && i.deadline && daysUntil(i.deadline, today()) >= 0)).slice(0, 5);
    $('upcoming').replaceChildren(...soon.map(i => {
      const li = el('li');
      li.append(
        el('span', { className: 'label', textContent: `${shortDate(i.deadline)} · ${deadlineText(i.deadline, today())}` }),
        el('a', { href: KINDS[i.kind].page, textContent: i.name }),
        el('span', { className: 'muted', textContent: KINDS[i.kind].label }),
      );
      return li;
    }));
    $('upcoming-section').hidden = !soon.length;
  }
})();
