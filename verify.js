// verify.html: a supervisor signs off one hours entry from the secret link a student sent them (functions in supabase-7.sql)
(async () => {
  const $ = id => document.getElementById(id);
  const say = text => { $('msg').textContent = text; };
  const token = new URLSearchParams(location.search).get('t');
  const longDate = d => new Date(d.length === 10 ? `${d}T00:00` : d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (!sb) return say("Couldn't connect. Check your internet connection.");
  if (!/^[0-9a-f-]{36}$/i.test(token || '')) return say("This sign-off link isn't complete. Ask the student to send it again.");

  const signedOff = e => say(`Signed off by ${e.verified_by} on ${longDate(e.verified_at)}. Thank you!`);

  const { data, error } = await sb.rpc('hours_for_signoff', { token });
  if (error) return say("Couldn't load this entry. Try again in a minute.");
  const entry = data?.[0];
  if (!entry) return say('This link has expired or was replaced. Ask the student for a new one.');
  if (entry.verified_at) return signedOff(entry);

  $('v-student').textContent = entry.student;
  $('v-date').textContent = longDate(entry.date);
  $('v-org').textContent = entry.org;
  $('v-activity').textContent = entry.activity || '—';
  $('v-hours').textContent = Number(entry.hours);
  const form = $('signoff');
  form.signer.value = entry.supervisor || '';
  $('entry').hidden = false;
  say('');

  form.onsubmit = async ev => {
    ev.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    const signer = form.signer.value.trim();
    const { data: ok, error: err } = await sb.rpc('sign_off_hours', { token, signer });
    if (err || !ok) {
      say(err ? "Couldn't sign off. Try again in a minute." : 'This entry was already signed off or changed.');
      btn.disabled = false;
      return;
    }
    $('entry').hidden = true;
    signedOff({ verified_by: signer, verified_at: new Date().toISOString() });
  };
})();
