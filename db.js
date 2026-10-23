// From Supabase → Project Settings → API. The publishable key is public by design; row level security protects the data.
const SUPABASE_URL = 'https://agzrnvwpcqmardoedsyx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_osjvA1NN-VNK9lfDrYPqOA_wS7Qm9-_';

const sb = SUPABASE_URL && window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
