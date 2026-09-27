// Loads a list of eligible voter emails into Supabase.
//
// Usage:
//   node scripts/import-voters.js email.txt
//
// email.txt: one email per line, e.g.
//   arjun_s@cs.iitr.ac.in
//   riya.m@iitr.ac.in
//
// Safe to re-run with an updated file — existing rows (and their
// has_voted / email_verified state) are left untouched; only genuinely
// new emails are added.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Hand-rolled .env.local loader — bypasses the `dotenv` package entirely so we
// don't depend on its version behaviour for overriding, BOM handling, etc.
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return { path: envPath, exists: false, keys: [] };
  const raw = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, ''); // strip BOM if present
  const keys = [];
  raw.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value; // force-override whatever was already set
    keys.push(key);
  });
  return { path: envPath, exists: true, keys };
}

const envInfo = loadEnvLocal();

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/import-voters.js path/to/email.txt');
  process.exit(1);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Looked for env file at:', envInfo.path);
  console.error('That file exists:', envInfo.exists);
  console.error('Keys found in it:', envInfo.keys);
  process.exit(1);
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const emails = [...new Set(
    raw.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(Boolean)
  )];

  if (emails.length === 0) {
    console.log('No emails found in', file);
    return;
  }

  const rows = emails.map(email => ({ email, email_verified: false, has_voted: false }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from('voters')
      .upsert(chunk, { onConflict: 'email', ignoreDuplicates: true });
    if (error) {
      console.error(`Failed on rows ${i}-${i + chunk.length}:`, error.message);
      process.exit(1);
    }
    console.log(`Processed ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }

  console.log(`Done — ${emails.length} unique email(s) from ${file} are now eligible voters.`);
}

main();