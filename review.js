// review.html: reviewers approve or reject event applications (supabase-9.sql); admins also manage the team
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
  let apps = [];

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
    $('r-tabs').replaceChildren(...Object.entries(TABS).map(([k, label]) => {
      const n = apps.filter(a => a.status === k).length;
      const b = el('button', { className: 'chip', type: 'button', textContent: `${label} (${n})` });
      b.setAttribute('aria-pressed', k === tab);
      b.onclick = () => { tab = k; render(); };
      return b;
    }));
    const list = apps.filter(a => a.status === tab);
    $('apps').replaceChildren(...list.map(card));
    $('apps-empty').hidden = list.length > 0;
  };

  const load = async () => {
    const { data, error } = await sb.from('event_applications').select().order('created_at', { ascending: false });
    if (error) return say(`Couldn't load applications: ${error.message}`);
    apps = data;
    render();
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
