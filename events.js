// submit-event.html: anyone can apply to list an event; applications wait for review (event_applications in supabase-8.sql)
(async () => {
  const $ = id => document.getElementById(id);
  const el = (tag, props) => Object.assign(document.createElement(tag), props);
  const KEY = 'comp-event-applications'; // this browser's submissions, so the organizer can see their status
  const f = $('event-form');
  const today = new Date().toLocaleDateString('en-CA');
  f.date.min = today;

  let mine = [];
  try { mine = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  const saveMine = () => { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch {} };

  const showFormat = () => { $('address-field').hidden = f.format.value === 'virtual'; f.address.required = f.format.value !== 'virtual'; };
  f.format.onchange = showFormat;
  showFormat();

  const STATUS = { pending: 'In review', approved: 'Approved, live on Find', rejected: 'Not approved', saved: 'Saved, not sent yet' };
  const renderMine = () => {
    $('mine').replaceChildren(...mine.map(a => {
      const c = el('article', { className: 'post' });
      const when = new Date(`${a.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      c.append(
        el('p', { className: `label status-${a.status}`, textContent: `${STATUS[a.status]} · submitted ${new Date(a.submitted).toLocaleDateString()}` }),
        el('h2', { textContent: a.title }),
        el('p', { className: 'muted', textContent: [a.org, when, a.format === 'virtual' ? 'Virtual' : a.address].filter(Boolean).join(' · ') }),
      );
      return c;
    }));
    $('mine-section').hidden = !mine.length;
  };

  f.onsubmit = async ev => {
    ev.preventDefault();
    if (f.end_time.value <= f.start_time.value) { $('msg').textContent = 'The end time needs to be after the start time.'; return; }
    const { agree, ...row } = Object.fromEntries([...new FormData(f)].filter(([, v]) => v !== ''));
    // Links are optional: "n/a", "none" or anything without a dot means no link; bare domains get https://
    for (const k of ['link', 'org_url']) {
      if (row[k] == null) continue;
      const v = row[k].trim();
      if (!v.includes('.')) delete row[k];
      else row[k] = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    }
    const btn = f.querySelector('button');
    btn.disabled = true;
    let status = 'pending';
    try {
      if (!sb) throw new Error('offline');
      const { error } = await sb.from('event_applications').insert(row);
      if (error) throw error;
      $('msg').textContent = `Thanks! "${row.title}" was submitted for review. We'll email ${row.contact_email} once it's approved.`;
    } catch (err) {
      // Review queue not reachable (offline, or supabase-8.sql not run yet): keep it here so nothing is lost
      status = 'saved';
      $('msg').textContent = `We couldn't reach the review queue, so "${row.title}" is saved on this device. Try submitting again later.`;
    }
    mine.unshift({ ...row, status, submitted: new Date().toISOString() });
    saveMine();
    renderMine();
    if (status === 'pending') f.reset(), showFormat();
    btn.disabled = false;
    $('msg').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  renderMine();
})();
