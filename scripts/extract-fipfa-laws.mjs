#!/usr/bin/env node
// FIPFA 경기규칙 원문 PDF 에서 **읽을 수 있는 영어 텍스트**를 뽑는다.
//
// 왜 도구가 필요한가 — 그냥 `pdftotext` 를 돌리면 **글자가 통째로 사라진다.**
// 그 PDF 의 폰트는 `ti`·`tt`·`ft`·`ct` 합자를 한 글리프로 그리는데 그 글리프에 유니코드
// 매핑이 없어서, 추출하면 그 자리가 **공백**이 된다:
//
//     Regula ons          -> Regulations
//     a acking            -> attacking
//     Compe on            -> Competition   (ti 가 두 번 연달아 빠진 자리)
//     mekeeper            -> timekeeper    (낱말 첫머리)
//     le the field        -> left the field(낱말 끝)
//     at the me of        -> at the time of('me' 는 그 자체가 낱말이라 자동으로 못 잡는다)
//
// `ﬁ ﬃ ﬀ ﬂ` 는 유니코드 표현형으로 살아 나오므로 그냥 풀어 주면 되고, 불릿은 사설 영역
// (U+F0B7)로 나온다. 진짜 문제는 위의 t-계열 합자뿐이다.
//
// ⚠️ **이 스크립트의 산출물을 그대로 믿지 마라.** 복원은 사전 조회 추론이라 오탐이 난다 —
// 실제로 `assis ve or protec ve`(assistive or protective)를 `assis vector protective` 로
// 잘못 붙인 적이 있다("ve"+"ct"+"or" = vector 가 사전에 있어서다). 그래서 `--report` 가
// **복원 전수를 출력**한다. 새 판을 뽑을 때마다 그 목록을 눈으로 훑을 것.
//
// 쓰는 법:
//   node scripts/extract-fipfa-laws.mjs <원문.pdf> [출력.txt] [--report]
//
// 필요한 것: `pdftotext`(poppler-utils) 와 영어 낱말 목록.
//   Debian/Ubuntu: apt install poppler-utils wamerican wbritish
// 낱말 목록 경로는 `--dict=<경로>` 로 바꿀 수 있다(기본은 /usr/share/dict/*-english).
//
// 이 저장소가 원문 텍스트를 **커밋하지 않는 이유**: FIPFA 의 저작물이다. 한국어 정본
// `docs/RULES-FIPFA-2025.md` 가 "전문 번역이 아니라 요약·재서술" 인 것과 같은 선을 지킨다.
// 영어 정본 `docs/RULES-FIPFA-2025.en.md` 도 재서술이고, 이 스크립트는 그 재서술을 쓸 때
// 원문을 읽기 위한 도구다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const dictFlag = args.find((a) => a.startsWith('--dict='));
const [pdf, out] = args.filter((a) => !a.startsWith('--'));

if (!pdf) {
  console.error('사용법: node scripts/extract-fipfa-laws.mjs <원문.pdf> [출력.txt] [--report] [--dict=경로]');
  process.exit(2);
}

// ── 사전 ─────────────────────────────────────────────────────────────────────
const DICT_PATHS = dictFlag ? [dictFlag.slice('--dict='.length)] : ['/usr/share/dict/american-english', '/usr/share/dict/british-english'];
const WORDS = new Set();
for (const p of DICT_PATHS) {
  if (!existsSync(p)) continue;
  for (const w of readFileSync(p, 'utf8').split('\n')) WORDS.add(w.trim().toLowerCase());
}
if (WORDS.size === 0) {
  console.error(`영어 낱말 목록을 못 찾았다: ${DICT_PATHS.join(', ')}\n  apt install wamerican wbritish  (또는 --dict=<경로>)`);
  process.exit(2);
}
// 규칙 문서 어휘 — 일반 사전에 없다. 없으면 복원이 연쇄로 어긋난다(위 assistive 사례).
for (const w of `powerchair powerchairs footguard footguards frontguard frontguards pylon pylons
scrimmage touchline touchlines unsporting repositioning misconduct restart restarts sanctioned
sanction sanctions cautionable substitution substitutions classifier classifiers reclassification
teamsheet teamsheets kickoff timekeeper seatbelt seatbelts fipfa ifab goalkeeper goalkeepers
assistive protective competitive repositioned deflected substituting matchday scorekeeper
mentorship kph`.split(/\s+/)) WORDS.add(w);

const ok = (w) => WORDS.has(w.replace(/^'+|'+$/g, '').toLowerCase());

// ── 합자 후보 ────────────────────────────────────────────────────────────────
// 한 자리에 둘까지 붙는다 — 'Compe' + ti + ti + 'ons'.
const LIGS = ['ti', 'tt', 'ft', 'ct', 'tf'];
const INSERTS = [...new Set([...LIGS, ...LIGS.flatMap((a) => LIGS.map((b) => a + b))])].sort((a, b) => a.length - b.length);

const uniqueMerge = (parts) => {
  const cands = new Set();
  if (parts.length === 2) {
    for (const i of INSERTS) if (ok(parts[0] + i + parts[1])) cands.add(parts[0] + i + parts[1]);
  } else {
    for (const x of INSERTS) for (const y of INSERTS) if (ok(parts[0] + x + parts[1] + y + parts[2])) cands.add(parts[0] + x + parts[1] + y + parts[2]);
  }
  return cands.size === 1 ? [...cands][0] : null;
};

const repairs = [];

/** 한 줄을 토큰 단위로 훑는다.
 *  ⚠️ 정규식 `\b(\w+) (\w+)\b` + replace 로 하면 안 된다 — 두 토큰을 다 소비해서
 *  'X posi ons' 의 ('posi','ons') 쌍이 **아예 시도되지 않는다**(앞 쌍이 먹어 버린다). */
function repairLine(line) {
  const toks = [...line.matchAll(/[A-Za-z']+/g)];
  if (toks.length === 0) return line;
  let out = '';
  let pos = 0;
  for (let i = 0; i < toks.length; ) {
    const m = toks[i];
    out += line.slice(pos, m.index);
    const gapAfter = (k) => (toks[k + 1] ? line.slice(toks[k].index + toks[k][0].length, toks[k + 1].index) === ' ' : false);
    let merged = null;
    let span = 0;

    // 3토큰 — 'par cipa on' = participation. 둘씩으로는 어느 쌍도 낱말이 안 돼 교착한다.
    if (i + 2 < toks.length && gapAfter(i) && gapAfter(i + 1)) {
      const [a, b, c] = [m[0], toks[i + 1][0], toks[i + 2][0]];
      const allWords = a.length > 2 && b.length > 2 && c.length > 2 && ok(a) && ok(b) && ok(c);
      if (/[a-z]/.test(b[0]) && /[a-z]/.test(c[0]) && !allWords) {
        const j = uniqueMerge([a, b, c]);
        if (j) { merged = j; span = 2; }
      }
    }
    // 2토큰. 길이 문턱을 두는 이유: 'a ached'(attached) 는 'a'·'ached' 가 각각 사전에 있어
    // "둘 다 낱말이면 건드리지 않는다" 규칙에 걸려 안 고쳐진다.
    if (merged === null && i + 1 < toks.length && gapAfter(i)) {
      const [a, b] = [m[0], toks[i + 1][0]];
      const allWords = a.length > 2 && b.length > 2 && ok(a) && ok(b);
      if (/[a-z]/.test(b[0]) && !allWords) {
        const j = uniqueMerge([a, b]);
        if (j) { merged = j; span = 1; }
      }
    }
    // 낱말 첫머리('mekeeper' = timekeeper) / 끝('le' = left).
    if (merged === null && !ok(m[0]) && /[a-z]/.test(m[0][0])) {
      const c = new Set();
      for (const i2 of INSERTS) {
        if (ok(i2 + m[0])) c.add(i2 + m[0]);
        if (ok(m[0] + i2)) c.add(m[0] + i2);
      }
      if (c.size === 1) { merged = [...c][0]; span = 0; }
    }

    if (merged) {
      repairs.push([toks.slice(i, i + span + 1).map((t) => t[0]).join(' '), merged]);
      out += merged;
      pos = toks[i + span].index + toks[i + span][0].length;
      i += span + 1;
    } else {
      out += m[0];
      pos = m.index + m[0].length;
      i += 1;
    }
  }
  return out + line.slice(pos);
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
let text;
try {
  text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch {
  console.error('pdftotext 실행 실패 — poppler-utils 가 필요하다 (apt install poppler-utils)');
  process.exit(2);
}

for (const [k, v] of Object.entries({ '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi', '\ufb04': 'ffl', '\uf0b7': '\u2022' })) {
  text = text.split(k).join(v);
}
text = text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
text = text.replace(/^\s*Approved April \d{4}\s+-?\s*\d*\s*-?\s*Official Document\s*$/gm, '');
text = text.replace(/^\s*In Partnership with\s*$/gm, '');

// 문단 잇기 — 빈 줄이 문단 경계, 그 밖의 줄바꿈은 공백. 합자가 줄 끝에서 끊긴 자리를
// 붙여 놔야 토큰 쌍으로 잡을 수 있다.
const paras = [];
let buf = [];
const flush = () => { if (buf.length) { paras.push(buf.join(' ').replace(/\s+/g, ' ').trim()); buf = []; } };
for (const raw of text.split('\n')) {
  const s = raw.trim();
  if (!s) { flush(); continue; }
  if (/^(LAW \d+|Law \d+|•)/.test(s)) flush();
  buf.push(s);
}
flush();
text = paras.filter(Boolean).join('\n\n');

let prev = null;
while (prev !== text) { prev = text; text = text.split('\n').map(repairLine).join('\n'); }

// 자동으로는 못 잡는 자리. 'me'/'mes' 는 그 자체가 영어 낱말이라 모든 규칙이 건너뛴다 —
// 이 문서에는 1인칭이 한 번도 안 나오므로(I/my/myself = 0건) 홀로 선 것은 전부 time/times 다.
text = text.replace(/\bmes\b/g, 'times').replace(/\bme\b/g, 'time').replace(/half-\s*time/g, 'half-time');

if (out) writeFileSync(out, text);
else process.stdout.write(text);

const unknown = [...text.matchAll(/\b[A-Za-z]{3,}\b/g)].map((m) => m[0]).filter((w) => !ok(w) && w !== w.toUpperCase());
console.error(`복원 ${repairs.length}건 / 고유 ${new Set(repairs.map(String)).size}종 · 문단 ${paras.length}개 · 남은 미지 낱말 ${new Set(unknown).size}종`);
if (flags.has('--report')) {
  const counted = new Map();
  for (const r of repairs) counted.set(String(r), (counted.get(String(r)) ?? 0) + 1);
  console.error('\n--- 복원 전수 (오탐 확인용 — 반드시 눈으로 훑을 것) ---');
  for (const [k, n] of [...counted].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(3)}  ${k}`);
  console.error(`\n--- 남은 미지 낱말 ---\n  ${[...new Set(unknown)].join(', ') || '(없음)'}`);
}
