// Curriculum gap audit: expected vs generated vs verified for every class.
//
// Reports, per class/subject:
//   expected   — chapters declared in src/lib/learn/video-chapters.ts
//   researched — public/videos/research/<slug>.extended.json with a full plan
//   baked      — public/videos/<slug>/full.html on disk
//   verified   — full.html exists AND extended json has >= plan.length segments
//   missing    — slugs absent from every stage
//
// Outputs JSON (machine-readable) + a console table.
//   npx tsx scripts/curriculum-gap-audit.ts [--json <path>] [--class 9]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LESSONS, VIDEO_CATALOG } from "../src/lib/learn/video-catalog";
import { extendedPath, type ExtendedFile } from "../src/lib/learn/lesson-research";

const args = process.argv.slice(2);
const argVal = (name: string): string | null => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  const a = args[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "");
};
const jsonOut = argVal("json");
const classFilter = Number(argVal("class") ?? NaN);

type ChapterRow = {
  slug: string;
  classLevel: number;
  subject: string;
  chapter: number;
  concept: string;
  researched: boolean;
  baked: boolean;
  verified: boolean;
  segments: number;
  planned: number;
  words: number;
  minutes: number;
  issues: string[];
};

const rows: ChapterRow[] = [];
for (const l of ALL_LESSONS) {
  if (Number.isFinite(classFilter) && l.classLevel !== classFilter) continue;
  const row: ChapterRow = {
    slug: l.slug,
    classLevel: l.classLevel,
    subject: l.subject,
    chapter: l.chapter,
    concept: l.concept,
    researched: false,
    baked: false,
    verified: false,
    segments: 0,
    planned: 0,
    words: 0,
    minutes: 0,
    issues: [],
  };
  const ep = extendedPath(l.slug);
  if (existsSync(ep)) {
    try {
      const f = JSON.parse(readFileSync(ep, "utf8")) as ExtendedFile;
      row.planned = Array.isArray(f.plan) ? f.plan.length : 0;
      const segs = (f.segments ?? []).filter((s) => s && typeof s.narration === "string" && s.narration.trim().length > 0);
      row.segments = segs.length;
      row.words = segs.reduce((n, s) => n + s.narration.trim().split(/\s+/).filter(Boolean).length, 0);
      row.minutes = segs.reduce((n, s) => n + (Number(s.minutes) || 5), 0);
      row.researched = row.planned > 0;
      if (row.planned > 0 && row.segments < row.planned) row.issues.push(`incomplete research ${row.segments}/${row.planned}`);
      const thin = segs.filter((s) => s.narration.trim().split(/\s+/).filter(Boolean).length < 200);
      if (thin.length) row.issues.push(`${thin.length} thin segment(s) <200 words`);
    } catch {
      row.issues.push("corrupt extended json");
    }
  } else {
    row.issues.push("no extended research");
  }
  const baked = join(process.cwd(), "public", "videos", l.slug, "full.html");
  row.baked = existsSync(baked);
  if (!row.baked) row.issues.push("no full.html");
  row.verified = row.baked && row.researched && row.segments >= Math.max(2, row.planned) && !row.issues.some((i) => i.startsWith("corrupt") || i.startsWith("incomplete"));
  rows.push(row);
}

const byClass = new Map<number, Map<string, ChapterRow[]>>();
for (const r of rows) {
  if (!byClass.has(r.classLevel)) byClass.set(r.classLevel, new Map());
  const m = byClass.get(r.classLevel)!;
  if (!m.has(r.subject)) m.set(r.subject, []);
  m.get(r.subject)!.push(r);
}

const summary: Record<string, unknown> = {};
let grandExpected = 0;
let grandVerified = 0;
console.log("");
const classKeys = Array.from(byClass.keys()).sort((a, b) => a - b);
for (const cls of classKeys) {
  const subjects = byClass.get(cls)!;
  const subjOut: Record<string, unknown> = {};
  let exp = 0;
  let ver = 0;
  console.log(`CLASS ${cls}`);
  const subjectEntries = Array.from(subjects.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [subject, list] of subjectEntries) {
    const v = list.filter((r: ChapterRow) => r.verified).length;
    exp += list.length;
    ver += v;
    const flag = v === list.length ? "OK " : "GAP";
    console.log(`  ${flag} ${subject.padEnd(11)} ${String(v).padStart(3)}/${String(list.length).padEnd(3)} verified   missing: ${list.length - v}`);
    subjOut[subject] = {
      expected: list.length,
      verified: v,
      missing: list.filter((r: ChapterRow) => !r.verified).map((r: ChapterRow) => ({ slug: r.slug, concept: r.concept, issues: r.issues })),
    };
  }
  grandExpected += exp;
  grandVerified += ver;
  console.log(`  TOTAL ${ver}/${exp}`);
  console.log("");
  summary[`class${cls}`] = { expected: exp, verified: ver, missing: exp - ver, subjects: subjOut };
}

const catalogTotal = VIDEO_CATALOG.reduce((n, c) => n + c.lessons.length, 0);
console.log(`CATALOG TOTAL: ${catalogTotal} chapters declared`);
console.log(`VERIFIED TOTAL: ${grandVerified}/${grandExpected} processed`);
console.log("");

const report = {
  catalogTotal,
  processed: grandExpected,
  verified: grandVerified,
  missingTotal: grandExpected - grandVerified,
  classes: summary,
  unverified: rows.filter((r) => !r.verified).map((r) => ({ slug: r.slug, class: r.classLevel, subject: r.subject, concept: r.concept, issues: r.issues })),
};
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  console.log(`wrote ${jsonOut}`);
}
