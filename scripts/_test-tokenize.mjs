import { readFileSync } from 'fs';
const SQL = readFileSync('D:/TuitionTrack/supabase/schema.sql', 'utf8');

// Find all dollar-quote boundaries
const positions = [];
for (let i = 0; i < SQL.length - 1; i++) {
  if (SQL[i] === '$' && (/\w/.test(SQL[i + 1]) || SQL[i + 1] === '$')) {
    // find the matching end of this sequence
    let j = i + 1;
    while (j < SQL.length && (/\w/.test(SQL[j]) || SQL[j] === '$')) j++;
    const tag = SQL.slice(i, j);
    positions.push({ pos: i, tag, context: SQL.slice(Math.max(0, i - 10), Math.min(SQL.length, i + tag.length + 10)) });
  }
}
console.log(`Dollar-quote markers: ${positions.length}`);
for (const p of positions) {
  console.log('  pos', p.pos, 'tag:', JSON.stringify(p.tag), '- ctx:', JSON.stringify(p.context));
}

console.log('');

// Also check the original tokeniser
const blocks = [];
const replaced = SQL.replace(/\$[^\$]+\$[\s\S]*?\$[^\$]+\$/gm, m => {
  blocks.push(m);
  return '\x00BLOCK_' + (blocks.length - 1) + '\x00';
});
const parts = replaced.split(';');
const tokens = [];
for (const part of parts) {
  let t = part.trim().replace(/\x00/g, '');
  if (!t || /^--/.test(t)) continue;
  let restored = part;
  for (let i = 0; i < blocks.length; i++) {
    restored = restored.replace('\x00BLOCK_' + i + '\x00', blocks[i]);
  }
  tokens.push(restored.trim().replace(/;$/, '').trim());
}
console.log(`Tokens after line-by-line split: ${tokens.length}`);
for (let i = 0; i < tokens.length; i++) {
  const s = tokens[i].replace(/\s+/g, ' ').replace(/\n/g, ' ').slice(0, 100);
  console.log(i + ': ' + s);
}
