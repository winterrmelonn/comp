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

// One-click "add to calendar" links; no account connection needed
function calendarLinks(item) {
  const next = new Date(Date.parse(item.deadline) + 864e5).toISOString().slice(0, 10);
  const title = item.title ?? `${item.name} deadline`;
  const details = [item.org, item.link].filter(Boolean).join('\n');
  const q = params => new URLSearchParams(params).toString();
  return {
    google: `https://calendar.google.com/calendar/render?${q({ action: 'TEMPLATE', text: title, dates: `${item.deadline.replace(/-/g, '')}/${next.replace(/-/g, '')}`, details })}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?${q({ path: '/calendar/action/compose', rru: 'addevent', subject: title, startdt: item.deadline, enddt: next, allday: 'true', body: details })}`,
  };
}

// CSV with a header row; Notion's CSV import turns it into a database
function csvOf(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.map(esc).join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

// Events from a calendar file (Canvas calendar feed, Google Calendar export...) as { title, date: YYYY-MM-DD }
function parseICS(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const unesc = v => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
  const events = [];
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') ev = {};
    else if (line === 'END:VEVENT') { if (ev?.title && ev.date) events.push(ev); ev = null; }
    else if (ev) {
      const i = line.indexOf(':');
      const key = line.slice(0, i).split(';')[0];
      const value = line.slice(i + 1);
      if (key === 'SUMMARY') ev.title = unesc(value);
      if (key === 'DTSTART' || (key === 'DUE' && !ev.date)) {
        const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
        if (!m) continue;
        // UTC times (Canvas uses these) become the local day; everything else keeps its written date
        ev.date = m[7] ? new Date(Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6])).toLocaleDateString('en-CA') : `${m[1]}-${m[2]}-${m[3]}`;
      }
    }
  }
  return events;
}

// Discover catalog (data/catalog.json). Items have an exact deadline confirmed on the official site,
// a usual due month (dueMonth), or are rolling.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Next due date for sorting and filtering; a usual month counts as its 15th.
// Late in that month it has probably closed, so it counts as next year's.
const LATE_IN_MONTH = 20;
const probablyClosed = (item, today) => !item.deadline && item.dueMonth === Number(today.slice(5, 7)) && Number(today.slice(8)) > LATE_IN_MONTH;

function nextDue(item, today) {
  if (item.deadline) return { date: item.deadline, exact: true };
  if (!item.dueMonth) return null;
  const [y, m] = today.split('-').map(Number);
  if (item.dueMonth === m && !probablyClosed(item, today)) return { date: today, exact: false };
  const year = item.dueMonth > m ? y : y + 1;
  return { date: `${year}-${String(item.dueMonth).padStart(2, '0')}-15`, exact: false };
}

function dueText(item, today) {
  if (item.deadline) return daysUntil(item.deadline, today) < 0 ? 'Closed for this year' : deadlineText(item.deadline, today);
  if (probablyClosed(item, today)) return `Usually due in ${MONTHS[item.dueMonth - 1]}, so likely closed this year`;
  if (item.dueMonth === Number(today.slice(5, 7))) return 'Usually due this month: check now';
  if (item.dueMonth) return `Usually due in ${MONTHS[item.dueMonth - 1]}`;
  return item.rolling ? 'Rolling: apply anytime' : 'Through your school';
}

const DUE_WINDOWS = { week: 8, month: 31, quarter: 92 };

// What a catalog item is, for the Discover tabs: scholarships, programs, competitions, volunteering, or community events
function typeOf(i) {
  if (i.type) return i.type;
  if (i.kind === 'scholarship') return 'scholarship';
  if (i.category === 'Competition' || i.category === 'Hackathon') return 'competition';
  if (i.category === 'Volunteering' || i.category === 'Service') return 'volunteer';
  return 'program';
}

function filterCatalog(items, f, today) {
  const q = (f.q || '').trim().toLowerCase();
  return items.filter(i => {
    if (q && ![i.name, i.org, i.summary, i.category, i.amountText, i.address, ...i.fields].join(' ').toLowerCase().includes(q)) return false;
    if (f.kind && i.kind !== f.kind) return false;
    if (f.type && typeOf(i) !== f.type) return false;
    if (f.format && (i.kind === 'scholarship' || (i.format || 'in_person') !== f.format)) return false;
    if (f.cost === 'free' && i.kind !== 'scholarship' && i.cost !== 'free') return false;
    if (f.cost === 'aid' && i.kind !== 'scholarship' && !['free', 'aid'].includes(i.cost)) return false;
    if (f.min && !(Number(i.amount) >= Number(f.min))) return false;
    if (f.confirmed && !i.verified) return false;
    if (f.grade && !i.grades.includes(Number(f.grade))) return false;
    if (f.field && !i.fields.includes(f.field)) return false;
    if (f.basis && i.basis !== f.basis) return false;
    if (f.region && i.region !== f.region) return false;
    if (f.free && i.kind === 'program' && i.cost !== 'free') return false;
    if (f.due) {
      const due = nextDue(i, today);
      if (!due || daysUntil(due.date, today) < 0 || daysUntil(due.date, today) > DUE_WINDOWS[f.due]) return false;
    }
    if (i.deadline && daysUntil(i.deadline, today) < 0 && !f.showClosed) return false;
    return true;
  });
}

function sortCatalog(items, sort, today) {
  const dueKey = i => nextDue(i, today)?.date || '9999';
  const by = {
    deadline: (a, b) => dueKey(a).localeCompare(dueKey(b)) || (b.verified - a.verified),
    amount: (a, b) => (b.amount ?? -1) - (a.amount ?? -1),
    name: () => 0,
  }[sort] || (() => 0);
  return [...items].sort((a, b) => by(a, b) || a.name.localeCompare(b.name));
}

if (typeof module === 'object') module.exports = { daysUntil, deadlineText, sortTracked, trackSummary, safeUrl, toICS, calendarLinks, csvOf, parseICS, nextDue, dueText, filterCatalog, sortCatalog, typeOf };

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

  // Logged in: data lives in Supabase (table in supabase-5.sql)
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
    $('t-search').oninput = $('t-sort').onchange = () => render();

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

      if (i.deadline && days >= 0 && !DONE.includes(i.status)) {
        const cal = calendarLinks(i);
        c.append(el('p', { className: 'cal-links' }));
        c.lastChild.append(
          el('a', { href: cal.google, target: '_blank', rel: 'noopener noreferrer', textContent: '+ Google Calendar', className: 'label' }),
          el('a', { href: cal.outlook, target: '_blank', rel: 'noopener noreferrer', textContent: '+ Outlook', className: 'label' }),
        );
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
      const q = $('t-search').value.trim().toLowerCase();
      const sort = $('t-sort').value;
      let shown = sortTracked(items.filter(FILTERS[filter][1])
        .filter(i => !q || [i.name, i.org, i.notes, i.category].join(' ').toLowerCase().includes(q)));
      if (sort === 'amount') shown.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
      if (sort === 'type') shown.sort((a, b) => (a.category || '~').localeCompare(b.category || '~'));
      if (sort === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
      $('list').replaceChildren(...shown.map(card));
      $('track-empty').hidden = shown.length > 0;
      $('ics').hidden = !items.some(i => i.deadline && !DONE.includes(i.status));
      $('export').hidden = !items.length;
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
          form.link.value = post.link ?? '';
          if (form.amount && post.amount) form.amount.value = post.amount;
          if (form.category && (post.kind ?? 'volunteer') === 'volunteer') form.category.value = 'Volunteering';
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

    const download = (text, type, name) => el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }).click();
    $('ics').onclick = () => download(toICS(items), 'text/calendar', `${kind}-deadlines.ics`);
    $('notion').onclick = () => download(csvOf(sortTracked(items).map(i => ({
      Name: i.name,
      [kind === 'scholarship' ? 'Offered by' : 'Run by']: i.org ?? '',
      ...(kind === 'scholarship' ? { Amount: i.amount ?? '' } : { Type: i.category ?? '' }),
      Deadline: i.deadline ?? '',
      Status: statusLabel(kind, i.status),
      Link: safeUrl(i.link) ?? '',
      Notes: i.notes ?? '',
    }))), 'text/csv', `comp-${KINDS[kind].page.replace('.html', '')}.csv`);

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

  // discover.html: the catalog in data/catalog.json plus approved community events, with filters kept in the URL
  if ($('catalog')) {
    const FIELDS_ = { stem: 'STEM', cs: 'Computer science', math: 'Math', arts: 'Arts', writing: 'Writing', humanities: 'Humanities', leadership: 'Leadership', service: 'Service', general: 'Any major' };
    const BASIS = { need: 'Need-based', merit: 'Merit', both: 'Merit + need', contest: 'Contest' };
    const COST = { free: 'Free', aid: 'Financial aid available', paid: 'Paid' };
    const TYPES = { '': 'All', scholarship: 'Scholarships', program: 'Programs', competition: 'Competitions', volunteer: 'Volunteering', event: 'Events' };
    // Panel filters: key → [label, options]; each shows as a removable chip when set
    const PANEL = {
      grade: ['Your grade', { 9: '9th grade', 10: '10th grade', 11: '11th grade', 12: '12th grade' }],
      field: ['Interest', FIELDS_],
      due: ['Due', { week: 'Due this week', month: 'Next 30 days', quarter: 'Next 3 months' }],
      basis: ['Scholarship type', BASIS],
      min: ['Award size', { 1000: '$1,000+', 5000: '$5,000+', 10000: '$10,000+', 25000: '$25,000+' }],
      cost: ['Cost', { free: 'Free only', aid: 'Free or financial aid' }],
      format: ['Format', { online: 'Online', in_person: 'In person' }],
      region: ['Open to', { National: 'Nationwide', California: 'California' }],
    };
    const TOGGLES = { confirmed: 'Confirmed dates only', untracked: 'Hide ones I track' };
    const KEYS = ['q', 'type', ...Object.keys(PANEL), 'sort'];
    const params = new URLSearchParams(location.search);
    const f = Object.fromEntries(KEYS.map(k => [k, params.get(k) || '']));
    for (const k of Object.keys(TOGGLES)) f[k] = params.get(k) === '1';
    if (params.get('kind')) f.type = params.get('kind'); // old links
    if (!f.grade) { try { f.grade = localStorage.getItem('comp-grade') || ''; } catch {} }
    f.sort ||= 'deadline';

    let catalog = [];
    let checked = '';
    try {
      const res = await fetch('data/catalog.json');
      ({ items: catalog, checked } = await res.json());
    } catch {
      say("Couldn't load the catalog. Check your connection and refresh.");
    }
    // Community events: approved applications (supabase-9.sql) and older club posts
    const asEvent = (e, src) => ({
      id: `${src}-${e.id}`, type: 'event', kind: 'program', category: 'Event', name: e.title, org: e.org || e.clubs?.name || '',
      url: safeUrl(e.link) || safeUrl(e.org_url) || '', deadline: e.date, verified: true, grades: [9, 10, 11, 12], fields: ['service'],
      cost: e.cost === 'paid' ? 'paid' : 'free', format: e.format === 'virtual' ? 'online' : 'in_person', region: 'Local',
      summary: e.description || e.details || '', address: e.address || e.location || '', time: e.start_time ? `${e.start_time.slice(0, 5)}–${e.end_time?.slice(0, 5)}` : e.time,
      hours: e.hours_offered, eligibility: e.eligibility,
    });
    if (sb) {
      const [ev, posts] = await Promise.all([
        sb.from('approved_events').select().order('date').then(r => r.data || [], () => []),
        sb.from('posts').select('*, clubs(name)').gte('date', today()).eq('kind', 'volunteer').order('date').then(r => r.data || [], () => []),
      ]);
      catalog = [...ev.map(e => asEvent(e, 'ev')), ...posts.map(p => asEvent(p, 'post')), ...catalog];
    }
    let mine = await tracked.list().catch(() => []);
    const isTracked = i => mine.some(t => t.kind === i.kind && t.name === i.name);

    // Controls
    const form = $('filters-form');
    form.onsubmit = ev => ev.preventDefault();
    $('d-q').value = f.q;
    $('d-sort').value = f.sort;
    $('d-q').oninput = () => { f.q = $('d-q').value; update(); };
    $('d-sort').onchange = () => { f.sort = $('d-sort').value; update(); };
    $('panel-fields').replaceChildren(...Object.entries(PANEL).map(([k, [label, opts]]) => {
      const sel = el('select', { name: k });
      sel.append(new Option('Any', ''), ...Object.entries(opts).map(([v, t]) => new Option(t, v)));
      sel.value = f[k];
      sel.onchange = () => { f[k] = sel.value; if (k === 'grade') { try { localStorage.setItem('comp-grade', f.grade); } catch {} } update(); };
      const l = el('label', { textContent: label });
      l.append(sel);
      return l;
    }), ...Object.entries(TOGGLES).map(([k, label]) => {
      const box = el('input', { type: 'checkbox', name: k, checked: f[k] });
      box.onchange = () => { f[k] = box.checked; update(); };
      const l = el('label', { className: 'check' });
      l.append(box, document.createTextNode(label));
      return l;
    }));
    const panel = $('filter-panel');
    $('filters-btn').onclick = () => { panel.hidden = !panel.hidden; $('filters-btn').setAttribute('aria-expanded', !panel.hidden); };
    $('panel-done').onclick = () => { panel.hidden = true; $('filters-btn').setAttribute('aria-expanded', 'false'); };
    const clearAll = () => {
      for (const k of [...Object.keys(PANEL)]) f[k] = '';
      for (const k of Object.keys(TOGGLES)) f[k] = false;
      try { localStorage.removeItem('comp-grade'); } catch {}
      for (const s of form.querySelectorAll('#panel-fields select')) s.value = '';
      for (const c of form.querySelectorAll('#panel-fields input')) c.checked = false;
      update();
    };
    $('panel-clear').onclick = clearAll;

    const trackButton = i => {
      const page = KINDS[i.kind].page;
      if (isTracked(i)) return el('a', { href: page, className: 'button', textContent: 'Tracked ✓' });
      const b = el('button', { textContent: i.type === 'event' ? 'Save' : 'Track', type: 'button' });
      b.onclick = async () => {
        b.disabled = true;
        const exact = !!i.deadline;
        try {
          await tracked.add([{
            kind: i.kind, name: i.name, org: i.org, amount: i.amount ?? null, category: i.category ?? null,
            deadline: exact ? i.deadline : null, link: i.url || null, status: 'interested',
            notes: [i.summary, exact ? null : `${dueText(i, today())}; check the official site for this year's date.`].filter(Boolean).join('\n'),
          }]);
          mine = await tracked.list().catch(() => mine);
          b.replaceWith(trackButton(i));
          say(`Added ${i.name} to your ${KINDS[i.kind].label.toLowerCase()}s.`);
        } catch (err) {
          b.disabled = false;
          say(`Couldn't track it: ${explain(err)}`);
        }
      };
      return b;
    };

    const TYPE_LABEL = { scholarship: 'Scholarship', program: 'Program', competition: 'Competition', volunteer: 'Volunteering', event: 'Event' };
    const card = i => {
      const t = typeOf(i);
      const c = el('article', { className: `post track type-${t}` });
      const ev = t === 'event';
      const due = ev ? null : dueText(i, today());
      const soon = i.deadline && daysUntil(i.deadline, today()) >= 0 && daysUntil(i.deadline, today()) <= 14;
      const date = i.deadline ? shortDate(i.deadline) : null;
      c.append(
        el('p', { className: `label${soon ? ' soon' : ''}`, textContent: [TYPE_LABEL[t], date, ev ? i.time : due].filter(Boolean).join(' · ') }),
        el('h2', { textContent: i.name }),
      );
      const grades = i.grades.length === 4 ? 'Grades 9–12' : i.grades.length === 1 ? `Grade ${i.grades[0]}` : `Grades ${i.grades[0]}–${i.grades.at(-1)}`;
      const money = i.kind === 'scholarship' ? i.amountText : ev ? [i.format === 'online' ? 'Virtual' : i.address] : [i.category, COST[i.cost]].filter(Boolean).join(' · ');
      c.append(
        el('p', { className: 'muted', textContent: [i.org, money].flat().filter(Boolean).join(' · ') }),
        el('p', { className: 'notes', textContent: i.summary }),
      );
      const tags = el('ul', { className: 'tags small' });
      tags.append(...(ev
        ? [i.eligibility, i.hours && `${Number(i.hours)} volunteer hours`, i.cost === 'paid' ? 'Paid' : 'Free']
        : [grades, i.region === 'National' ? 'Nationwide' : `${i.region} only`, i.format === 'online' ? 'Online' : null, BASIS[i.basis], ...i.fields.map(k => FIELDS_[k])])
        .filter(Boolean).map(x => el('li', { textContent: x })));
      c.append(tags);
      const links = el('p', { className: 'cal-links' });
      if (i.url) links.append(el('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer', className: 'label', textContent: ev ? 'Details & sign up ↗' : 'Official site ↗' }));
      if (i.deadline && daysUntil(i.deadline, today()) >= 0) {
        links.append(el('a', { href: calendarLinks({ name: i.name, title: ev ? i.name : undefined, deadline: i.deadline, org: i.org, link: i.url }).google, target: '_blank', rel: 'noopener noreferrer', className: 'label', textContent: '+ Google Calendar' }));
      }
      if (i.verified && !ev) links.append(el('span', { className: 'label muted', textContent: `Date confirmed ${shortDate(checked)}` }));
      c.append(links, el('div', { className: 'row' }));
      c.lastChild.append(trackButton(i));
      return c;
    };

    const update = () => {
      const base = filterCatalog(catalog, { ...f, type: '' }, today()).filter(i => !f.untracked || !isTracked(i));
      const counts = base.reduce((m, i) => (m[typeOf(i)] = (m[typeOf(i)] || 0) + 1, m), {});
      $('type-tabs').replaceChildren(...Object.entries(TYPES).filter(([k]) => k !== 'event' || counts.event || f.type === 'event').map(([k, label]) => {
        const b = el('button', { className: 'tab', type: 'button' });
        b.append(label, el('span', { className: 'n', textContent: k ? counts[k] || 0 : base.length }));
        b.setAttribute('aria-pressed', f.type === k);
        b.onclick = () => { f.type = k; update(); };
        return b;
      }));
      const shown = sortCatalog(base.filter(i => !f.type || typeOf(i) === f.type), f.sort, today());
      $('catalog').replaceChildren(...shown.map(card));
      $('count').textContent = `${shown.length} ${shown.length === 1 ? 'result' : 'results'}`;
      $('catalog-empty').hidden = shown.length > 0;

      // Active filters as removable chips; the Filters button shows how many are on
      const active = [
        ...Object.entries(PANEL).filter(([k]) => f[k]).map(([k, [, opts]]) => [k, opts[f[k]]]),
        ...Object.entries(TOGGLES).filter(([k]) => f[k]).map(([k, label]) => [k, label]),
      ];
      $('active-filters').replaceChildren(...active.map(([k, label]) => {
        const b = el('button', { className: 'chip on', type: 'button', textContent: `${label} ×` });
        b.setAttribute('aria-label', `Remove filter: ${label}`);
        b.onclick = () => {
          f[k] = typeof f[k] === 'boolean' ? false : '';
          const input = form.querySelector(`#panel-fields [name=${k}]`);
          if (input) input.type === 'checkbox' ? (input.checked = false) : (input.value = '');
          if (k === 'grade') { try { localStorage.removeItem('comp-grade'); } catch {} }
          update();
        };
        return b;
      }), ...(active.length > 1 ? [Object.assign(el('button', { className: 'chip link', type: 'button', textContent: 'Clear all' }), { onclick: clearAll })] : []));
      $('f-count').textContent = active.length || '';
      $('f-count').hidden = !active.length;

      const qs = new URLSearchParams(Object.entries({ ...f, sort: f.sort === 'deadline' ? '' : f.sort })
        .map(([k, v]) => [k, v === true ? '1' : v === false ? '' : v]).filter(([, v]) => v));
      history.replaceState(null, '', qs.size ? `?${qs}` : location.pathname);
    };

    update();
  }

  // Calendars imported from .ics files (Canvas, Google, Outlook, Apple), kept in this browser
  const CAL_KEY = 'comp-calendars';
  let calendars = [];
  try { calendars = JSON.parse(localStorage.getItem(CAL_KEY)) || []; } catch {}
  const saveCalendars = () => {
    try { localStorage.setItem(CAL_KEY, JSON.stringify(calendars)); return true; }
    catch { say("Couldn't save that calendar in this browser."); return false; }
  };
  // Hours: same sources as the profile page (Supabase when logged in, else this browser)
  const loadHours = async cols => {
    let guest = [];
    try { guest = JSON.parse(localStorage.getItem('comp'))?.entries || []; } catch {}
    return user ? await sb.from('hours').select(cols).then(r => r.data || []) : guest;
  };
  const GOAL = window.compGoal ? compGoal() : 100;

  // home.html: hours progress, then upcoming deadlines from scholarships, programs and imported calendars
  if ($('upcoming')) {
    const hourRows = await loadHours('hours');
    const total = Math.round(hourRows.reduce((sum, e) => sum + Number(e.hours), 0) * 100) / 100;
    $('h-total').textContent = total;
    $('h-goal').textContent = GOAL;
    $('h-bar').max = GOAL;
    $('h-bar').value = Math.min(total, GOAL);
    $('h-left').textContent = total >= GOAL ? 'Goal reached 🎉' : `${Math.round((GOAL - total) * 100) / 100} hours to go`;
    $('h-pct').textContent = `${Math.min(100, Math.round(total / GOAL * 100))}%`;

    const items = await tracked.list().catch(() => []);
    const t = today();
    const fromTrackers = items.filter(i => isActive(i) && i.deadline && daysUntil(i.deadline, t) >= 0)
      .map(i => ({ date: i.deadline, title: i.name, source: KINDS[i.kind].label, href: KINDS[i.kind].page }));
    // Calendars can hold hundreds of events, so only the next two weeks of those
    const fromCalendars = calendars.flatMap(c => c.events
      .filter(e => daysUntil(e.date, t) >= 0 && daysUntil(e.date, t) <= 14)
      .map(e => ({ ...e, source: c.name })));
    const soon = [...fromTrackers, ...fromCalendars].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

    $('upcoming').replaceChildren(...soon.map(i => {
      const li = el('li');
      li.append(
        el('span', { className: 'label', textContent: `${shortDate(i.date)} · ${deadlineText(i.date, t)}` }),
        i.href ? el('a', { href: i.href, textContent: i.title }) : el('span', { className: 'title', textContent: i.title }),
        el('span', { className: 'muted', textContent: i.source }),
      );
      return li;
    }));
    $('upcoming-empty').hidden = soon.length > 0;
    if ($('cal-count')) $('cal-count').textContent = calendars.length ? `${calendars.length} connected` : 'None connected yet';
  }

  // calendar.html: month view of deadlines, logged hours and connected calendars
  if ($('cal-grid')) {
    const t = today();
    const [items, hourRows] = await Promise.all([tracked.list().catch(() => []), loadHours('date, org, hours').catch(() => [])]);
    let cursor = new Date(`${t.slice(0, 7)}-01T00:00`);
    let picked = t;
    const hidden = new Set();
    const ymd = d => d.toLocaleDateString('en-CA');

    const allEvents = () => [
      ...items.filter(i => i.deadline).map(i => ({ date: i.deadline, title: `${i.name} deadline`, type: i.kind, source: KINDS[i.kind].label, href: KINDS[i.kind].page, done: !isActive(i) })),
      ...hourRows.map(h => ({ date: h.date, title: `${Number(h.hours)} h · ${h.org}`, type: 'hours', source: 'Volunteer hours', href: 'profile.html' })),
      ...calendars.flatMap(c => c.events.map(e => ({ ...e, type: 'cal', source: c.name }))),
    ].filter(e => !hidden.has(e.source));

    const render = () => {
      const events = allEvents();
      const byDay = Map.groupBy ? Map.groupBy(events, e => e.date) : events.reduce((m, e) => m.set(e.date, [...(m.get(e.date) || []), e]), new Map());
      $('cal-title').textContent = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const start = new Date(cursor);
      start.setDate(1 - start.getDay());
      const cells = [];
      for (let n = 0; n < 42; n++) {
        const d = new Date(start);
        d.setDate(start.getDate() + n);
        const key = ymd(d);
        const list = byDay.get(key) || [];
        const cell = el('button', { type: 'button', className: 'day' });
        if (d.getMonth() !== cursor.getMonth()) cell.classList.add('other');
        if (key === t) cell.classList.add('today');
        if (key === picked) cell.classList.add('picked');
        cell.setAttribute('aria-label', `${d.toDateString()}, ${list.length} events`);
        cell.append(el('span', { className: 'num', textContent: d.getDate() }));
        for (const e of list.slice(0, 3)) cell.append(el('span', { className: `ev ev-${e.type}`, textContent: e.title }));
        if (list.length > 3) cell.append(el('span', { className: 'more', textContent: `+${list.length - 3} more` }));
        cell.onclick = () => { picked = key; render(); };
        cells.push(cell);
      }
      $('cal-grid').replaceChildren(...cells);

      const list = byDay.get(picked) || [];
      $('day-title').textContent = new Date(`${picked}T00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      $('day-list').replaceChildren(...list.map(e => {
        const li = el('li', { className: `ev-${e.type}` });
        li.append(e.href ? el('a', { href: e.href, textContent: e.title }) : el('span', { className: 'title', textContent: e.title }), el('span', { className: 'muted', textContent: e.source }));
        return li;
      }));
      $('day-empty').hidden = list.length > 0;

      // Sources: built-in ones plus each connected calendar, each can be hidden
      const sources = [['Scholarship', 'scholarship'], ['Program', 'program'], ['Volunteer hours', 'hours'], ...calendars.map(c => [c.name, 'cal'])];
      $('cal-sources').replaceChildren(...sources.map(([name, type], n) => {
        const li = el('li', { className: `src ev-${type}` });
        const box = el('input', { type: 'checkbox', checked: !hidden.has(name) });
        box.onchange = () => { box.checked ? hidden.delete(name) : hidden.add(name); render(); };
        const label = el('label', { className: 'check' });
        label.append(box, el('span', { className: 'dot' }), document.createTextNode(name));
        li.append(label);
        if (type === 'cal') {
          const c = calendars.find(x => x.name === name);
          const x = el('button', { className: 'chip', textContent: 'Disconnect', type: 'button' });
          x.onclick = () => { calendars = calendars.filter(y => y !== c); saveCalendars(); render(); };
          li.append(el('span', { className: 'muted', textContent: `${c.events.length} events` }), x);
        }
        return li;
      }));
    };

    $('cal-prev').onclick = () => { cursor.setMonth(cursor.getMonth() - 1); render(); };
    $('cal-next').onclick = () => { cursor.setMonth(cursor.getMonth() + 1); render(); };
    $('cal-today').onclick = () => { cursor = new Date(`${t.slice(0, 7)}-01T00:00`); picked = t; render(); };

    $('ics-file').onchange = async ev => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      const text = await file.text();
      // Keep the last month and everything ahead, capped so big feeds fit in localStorage
      const events = parseICS(text).filter(e => daysUntil(e.date, today()) >= -31).slice(0, 800);
      if (!events.length) { say(`No upcoming events found in ${file.name}.`); return; }
      const name = text.match(/^X-WR-CALNAME:(.+)$/m)?.[1].trim() || file.name.replace(/\.ics$/i, '');
      calendars = calendars.filter(c => c.name !== name).concat({ name, events });
      if (saveCalendars()) say(`Connected ${name}: ${events.length} events.`);
      render();
    };

    $('cal-export').onclick = () => {
      const blob = new Blob([toICS(items)], { type: 'text/calendar' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'comp-deadlines.ics' });
      a.click();
      URL.revokeObjectURL(a.href);
    };

    render();
  }
})();
