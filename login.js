// From Supabase → Project Settings → API. The anon key is public by design; row level security protects the data.
const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

const $ = id => document.getElementById(id);
const form = $('auth');
const submit = form.querySelector('button');
let signingUp = false;

$('toggle').onclick = ev => {
  ev.preventDefault();
  signingUp = !signingUp;
  $('title').textContent = signingUp ? 'Create account' : 'Log in';
  submit.textContent = signingUp ? 'Sign up' : 'Log in';
  form.password.autocomplete = signingUp ? 'new-password' : 'current-password';
  ev.target.textContent = signingUp ? 'I already have an account' : 'Create an account';
  $('msg').textContent = '';
};

if (!SUPABASE_URL) {
  $('msg').textContent = "Accounts aren't connected yet. Add the Supabase URL and key at the top of login.js.";
  submit.disabled = true;
} else {
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const showSession = session => {
    form.hidden = !!session;
    $('logout').hidden = !session;
    $('msg').textContent = session ? `Logged in as ${session.user.email}.` : '';
  };
  sb.auth.getSession().then(({ data }) => showSession(data.session));

  form.onsubmit = async ev => {
    ev.preventDefault();
    submit.disabled = true;
    $('msg').textContent = '';
    const creds = { email: form.email.value, password: form.password.value };
    try {
      const { data, error } = signingUp ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
      if (error?.name === 'AuthRetryableFetchError') throw error;
      if (error) $('msg').textContent = error.message;
      else if (!data.session) $('msg').textContent = 'Check your email to confirm your account, then log in.';
      else location.href = 'home.html';
    } catch {
      $('msg').textContent = "Couldn't reach the server. Check your connection and try again.";
    }
    submit.disabled = false;
  };

  $('logout').onclick = async () => {
    await sb.auth.signOut();
    showSession(null);
  };
}
