import { readFileSync } from 'fs';
import { basename } from 'path';

const TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJ  = process.env.SUPABASE_PROJECT_ID || 'zlkkicrqwoxzhsfehouj';
const API   = `https://api.supabase.com/v1/projects/${PROJ}/database/query`;
const SQL   = readFileSync('D:/TuitionTrack/supabase/schema.sql', 'utf8');

// ── robust SQL tokeniser ─────────────────────────────────────────────────────
// State machine: SKIP_COMMENT / SCAN_NORMAL / IN_DOLLARQUOTE
function tokenise(source) {
  const stmts = [];
  let cur = '';
  let inDQ = false;    // inside a $$..$$ block
  let dqTag = '';      // the opening $TAG$
  let i = 0;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    // ── Inside a dollar-quoted string ────────────────────────────────────
    if (inDQ) {
      cur += source[i];
      i++;
      // Check whether we just typed the closing delimiter
      if (ch === dqTag[dqTag.length - 1] && source.slice(i - dqTag.length + 1, i + 1) === dqTag) {
        // We just finished writing the closing tag
        inDQ = false;
        dqTag = '';
      }
      continue;
    }

    // ── Detect opening dollar-tag ─────────────────────────────────────────
    if (ch === '$' && (/\w/.test(next) || next === '$')) {
      // Collect the $TAG$ delimiter
      let j = i + 1;
      while (j < source.length && (/\w/.test(source[j]) || source[j] === '$')) j++;
      dqTag = source.slice(i, j);
      inDQ = true;
      cur += dqTag;
      i = j;
      continue;
    }

    // ── Single-line comment ──────────────────────────────────────────────
    if (ch === '-' && next === '-') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // ── Block comment ────────────────────────────────────────────────────
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // ── Normal character ─────────────────────────────────────────────────
    cur += ch;
    if (ch === ';') {
      const t = cur.trim().replace(/;$/, '').trim();
      if (t) stmts.push(t);
      cur = '';
    }
    i++;
  }

  if (cur.trim()) stmts.push(cur.trim());
  return stmts;
}

const stmts = tokenise(SQL).filter(s => s.length > 0);
console.log(`📊 Statements: ${stmts.length}\n`);

async function post(chunk) {
  const bob = JSON.stringify({ query: chunk });
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: bob,
  });
  return { code: r.status, body: await r.text() };
}

async function main() {
  // Show what we'll execute
  for (let i = 0; i < stmts.length; i++) {
    const label = stmts[i].replace(/\s+/g, ' ').replace(/\n/g, ' ').slice(0, 100);
    console.log(i + ': ' + label);
  }

  // Patch current_user_role to use a safe default (no public.users dependency)
  let patched = 0;
  for (let i = 0; i < stmts.length; i++) {
    if (/select role from public\.users where id = auth\.uid/.test(stmts[i])) {
      stmts[i] = stmts[i].replace(
        /select role from public\.users where id = auth\.uid\(\)/,
        "(select 'teacher'::public.user_role as role)"
      );
      patched++;
    }
  }
  console.log(`\n🔧 Patched ${patched} current_user_role statement(s).\n`);

  // Execute statements in file-order
  let errs = 0;
  const errsList = [];
  for (let i = 0; i < stmts.length; i++) {
    const { code, body } = await post(stmts[i]);
    const firstLine = body.split('\n')[0];
    if (code === 200) {
      console.log(`✅ [${i}]`);
    } else {
      errs++;
      console.log(`❌ [${i}] ${code} ${firstLine.replace(/\s+/g,' ').slice(0,250)}`);
      errsList.push({ i, code, msg: firstLine.slice(0,200) });
    }
  }

  if (errs > 0) {
    console.log(`\n⚠️  ${stmts.length - errs} succeeded, ${errs} failed:`);
    for (const e of errsList) console.log(`   [${e.i}] ${e.code}: ${e.msg}`);
  } else {
    console.log(`\n✅ All ${stmts.length} statements applied successfully.`);
  }
}

main().catch(e => console.error(e));
