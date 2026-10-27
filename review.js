// review.html: reviewers approve or reject event applications (supabase-9.sql) and AI-drafted catalog entries
// (supabase-10.sql); admins also manage the team
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const say = t => { $('msg').textContent = t; };
  if (!sb) return say("Couldn't connect. Check your internet connection.");
  const user = (await sb.auth.getSession()).data.session?.user;
  if (!user) { say('Log in with a reviewer account to review events. '); $('msg').append(el('a', { href: 'login.html', textContent: 'Log in' })); return; }
  const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw error; return data; };

  let reviewer = false, admin = false;
  try { [reviewer, admin] = await Promise.all([rpc('is_reviewer'), rpc('is_admin')]); }
  catch (err) { return say(err.code === 'PGRST202' ? 'Reviewing isn\'t set up yet (supabase-9.sql hasn\'t been run).' : `Couldn't check access: ${err.message}`); }
  if (!reviewer) return say("Your account isn't a reviewer. Ask an admin to add you.");
  $('review').hidden = false;

  const TABS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  const KIND = { volunteer: 'Volunteer', workshop: 'Workshop', competition: 'Competition', info: 'Info session', other: 'Other' };
  let tab = 'pending';
  let section = 'events';
  let apps = [];
  let drafts = [];
  let draftsReady = true;

  const fact = (k, v) => v ? [el('dt', { textContent: k }), el('dd', { textContent: v })] : [];
  const card = a => {
    const c = el('article', { className: 'post' });
    const when = new Date(`${a.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    c.append(
      el('p', { className: `label status-${a.status}`, textContent: `${KIND[a.kind] || a.kind} · ${a.category || ''} · submitted ${new Date(a.created_at).toLocaleDateString()}` }),
      el('h2', { textContent: a.title }),
      el('p', { className: 'notes', textContent: a.description }),
    );
    const dl = el('dl', { className: 'facts' });
    dl.append(
      ...fact('When', `${when}, ${a.start_time?.slice(0, 5)}–${a.end_time?.slice(0, 5)}${a.repeats ? ` (${a.repeats})` : ''}`),
      ...fact('Where', a.format === 'virtual' ? 'Virtual' : `${a.format === 'hybrid' ? 'Hybrid · ' : ''}${a.address || ''}`),
      ...fact('Open to', a.eligibility), ...fact('Spots', a.capacity && String(a.capacity)),
      ...fact('Hours offered', a.hours_offered && String(a.hours_offered)), ...fact('Cost', a.cost),
      ...fact('Registration', a.link), ...fact('Organization', [a.org, a.org_url].filter(Boolean).join(' · ')),
      ...fact('Contact', [a.contact_name, a.contact_role, a.contact_email, a.contact_phone].filter(Boolean).join(' · ')),
      ...fact('Signs off hours', a.supervisor), ...fact('Review note', a.review_note),
    );
    c.append(dl);
    const row = el('div', { className: 'row' });
    const note = el('input', { placeholder: 'Note to keep with the decision (optional)', value: a.review_note || '' });
    const decide = status => async () => {
      try {
        const { error } = await sb.from('event_applications').update({ status, review_note: note.value.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', a.id);
        if (error) throw error;
        say(`${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Moved back to pending'}: ${a.title}${status === 'approved' ? '. It\'s now on Discover.' : ''}`);
        await load();
      } catch (err) { say(`Couldn't save: ${err.message}`); }
    };
    const btn = (text, status, cls) => Object.assign(el('button', { type: 'button', textContent: text, className: cls }), { onclick: decide(status) });
    if (a.status !== 'approved') row.append(btn('Approve', 'approved', ''));
    if (a.status !== 'rejected') row.append(btn('Reject', 'rejected', 'secondary'));
    if (a.status !== 'pending') row.append(btn('Back to pending', 'pending', 'secondary'));
    if (a.contact_email) row.append(el('a', { className: 'button secondary', href: `mailto:${a.contact_email}?subject=${encodeURIComponent(`Your event "${a.title}"`)}`, textContent: 'Email organizer' }));
    c.append(note, row);
    return c;
  };

  const render = () => {
    const rows = section === 'events' ? apps : drafts;
    $('n-events').textContent = apps.filter(a => a.status === 'pending').length;
    $('n-drafts').textContent = drafts.filter(a => a.status === 'pending').length;
    for (const b of $('r-sections').children) b.setAttribute('aria-pressed', b.dataset.section === section);
    $('r-tabs').replaceChildren(...Object.entries(TABS).map(([k, label]) => {
      const n = rows.filter(a => a.status === k).length;
      const b = el('button', { className: 'chip', type: 'button', textContent: `${label} (${n})` });
      b.setAttribute('aria-pressed', k === tab);
      b.onclick = () => { tab = k; render(); };
      return b;
    }));
    const list = rows.filter(a => a.status === tab);
    $('apps').replaceChildren(...list.map(section === 'events' ? card : draftCard));
    $('apps-empty').hidden = list.length > 0;
    $('apps-empty').textContent = section === 'drafts' && !draftsReady ? "Catalog drafts aren't set up yet (supabase-10.sql hasn't been run)." : 'Nothing here. 🎉';
  };
  for (const b of $('r-sections').children) b.onclick = () => { section = b.dataset.section; tab = 'pending'; render(); };

  const load = async () => {
    const [a, d] = await Promise.all([
      sb.from('event_applications').select().order('created_at', { ascending: false }),
      sb.from('catalog_drafts').select().order('created_at', { ascending: false }),
    ]);
    if (a.error) say(`Couldn't load applications: ${a.error.message}`);
    else apps = a.data;
    draftsReady = !d.error;
    drafts = d.data || [];
    render();
  };

  // Catalog drafts: the reviewer checks the quotes against the official page, fixes fields, and approves
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const draftCard = d => {
    const e = { ...d.entry };
    const c = el('article', { className: 'post' });
    c.append(
      el('p', { className: `label status-${d.status}`, textContent: `${d.updates ? `Update to "${d.updates}"` : 'New entry'} · ${e.kind} · confidence ${d.confidence || '?'} · drafted ${new Date(d.created_at).toLocaleDateString()}` }),
      el('h2', { textContent: e.name }),
      el('p', { className: 'muted', textContent: [e.org, e.amountText].filter(Boolean).join(' · ') }),
    );
    const page = el('p', { className: 'cal-links' });
    page.append(el('a', { href: e.url || d.source_url, target: '_blank', rel: 'noopener noreferrer', textContent: 'Open the official page ↗' }));
    c.append(page);
    if (d.concerns?.length) {
      const ul = el('ul', { className: 'concerns' });
      ul.append(...d.concerns.map(t => el('li', { textContent: t })));
      c.append(el('p', { className: 'label', textContent: 'Check these' }), ul);
    }
    const ev = d.evidence || {};
    const dl = el('dl', { className: 'facts' });
    for (const k of ['deadline', 'amount', 'eligibility']) if (ev[k]) dl.append(el('dt', { textContent: `Page says (${k})` }), el('dd', { textContent: `“${ev[k]}”` }));
    if (dl.children.length) c.append(dl);

    // Editable fields: what goes live is what's in these boxes
    const f = el('div', { className: 'grid' });
    const input = (label, key, props = {}) => {
      const i = el('input', { value: e[key] ?? '', ...props });
      i.oninput = () => { e[key] = i.type === 'number' ? (i.value === '' ? null : Number(i.value)) : i.value || null; };
      const l = el('label', { textContent: label, className: props.wide ? 'wide' : '' });
      l.append(i);
      f.append(l);
    };
    input('Name', 'name');
    input('Organization', 'org');
    input('Deadline', 'deadline', { type: 'date' });
    const month = el('select');
    month.append(new Option('—', ''), ...MONTHS.map((m, n) => new Option(m, n + 1)));
    month.value = e.dueMonth ?? '';
    month.onchange = () => { e.dueMonth = month.value ? Number(month.value) : null; };
    const ml = el('label', { textContent: 'Usual month (if no exact date)' });
    ml.append(month);
    f.append(ml);
    input('Award', 'amountText');
    input('Largest award ($)', 'amount', { type: 'number', min: 0 });
    input('Link', 'url', { wide: true });
    const sum = el('textarea', { rows: 2, value: e.summary ?? '' });
    sum.oninput = () => { e.summary = sum.value; };
    const sl = el('label', { textContent: 'Summary', className: 'wide' });
    sl.append(sum);
    f.append(sl);
    const ver = el('input', { type: 'checkbox', checked: !!e.verified });
    ver.onchange = () => { e.verified = ver.checked; };
    const vl = el('label', { className: 'check wide' });
    vl.append(ver, document.createTextNode("I confirmed this year's deadline on the official page"));
    f.append(vl);
    c.append(f);

    const note = el('input', { placeholder: 'Note (optional)', value: d.review_note || '' });
    const row = el('div', { className: 'row' });
    const decide = status => async () => {
      if (status === 'approved' && e.verified && !e.deadline) return say('A confirmed entry needs an exact deadline.');
      if (status === 'approved' && !e.deadline && !e.dueMonth && !e.rolling) return say('Add a deadline or usual month before approving.');
      const { error } = await sb.from('catalog_drafts').update({ status, entry: e, review_note: note.value.trim() || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', d.id);
      if (error) return say(`Couldn't save: ${error.message}`);
      say(`${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Moved back to pending'}: ${e.name}${status === 'approved' ? '. It\'s now on Discover.' : ''}`);
      await load();
    };
    const btn = (text, status, cls) => Object.assign(el('button', { type: 'button', textContent: text, className: cls }), { onclick: decide(status) });
    if (d.status !== 'approved') row.append(btn('Approve', 'approved', ''));
    if (d.status === 'approved') row.append(btn('Save changes', 'approved', ''));
    if (d.status !== 'rejected') row.append(btn('Reject', 'rejected', 'secondary'));
    if (d.status !== 'pending') row.append(btn('Back to pending', 'pending', 'secondary'));
    c.append(note, row);
    return c;
  };

  const loadTeam = async () => {
    const team = await rpc('list_reviewers').catch(() => []);
    $('team').replaceChildren(...team.map(t => {
      const li = el('li');
      li.append(el('span', { textContent: t.email }), el('span', { className: 'muted', textContent: t.role === 'admin' ? 'Admin' : 'Reviewer' }));
      if (admin && t.user_id !== user.id) {
        const x = el('button', { className: 'chip', type: 'button', textContent: 'Remove' });
        x.onclick = async () => { const { error } = await sb.from('reviewers').delete().eq('user_id', t.user_id); say(error ? `Couldn't remove: ${error.message}` : `Removed ${t.email}.`); loadTeam(); };
        li.append(x);
      }
      return li;
    }));
  };
  if (admin) {
    const f = $('add-reviewer');
    f.hidden = false;
    f.onsubmit = async ev => {
      ev.preventDefault();
      try { await rpc('add_reviewer', { email: f.email.value.trim(), new_role: f.role.value }); say(`Added ${f.email.value.trim()}.`); f.reset(); loadTeam(); }
      catch (err) { say(err.message); }
    };
  }

  await Promise.all([load(), loadTeam()]);
})();
