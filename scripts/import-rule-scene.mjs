#!/usr/bin/env node
// 드릴 편집기가 내보낸 봉투에서 드릴 하나를 꺼내 규칙 화면 장면 모듈(`.scene.ts`)로 떨군다.
//
// 왜 스크립트인가: 규칙 장면은 이제 두 갈래다(src/features/rules/ruleScenes.ts 머리말).
// 손코딩 갈래는 `SeedDrillSpec` 을 사람이 적지만, 편집기로 만든 갈래는 **좌표를 손으로 옮겨
// 적으면 안 된다** — 그 순간 shapes·ballOwner·화살표 색·자유 ctrl·메모 스타일이 유실된다.
// 그래서 사람이 손대는 부분을 0으로 만들고, 파일 전체를 여기서 찍는다.
//
//   node scripts/import-rule-scene.mjs <봉투.json> --list
//       봉투 안의 드릴 목록(제목·스텝 수·코트)만 찍는다. 제목을 확인하는 용도.
//   node scripts/import-rule-scene.mjs <봉투.json> <출력.scene.ts> --title '2-4 골킥'
//       그 드릴을 `.scene.ts` 로 쓴다. 드릴 단건 봉투면 --title 은 생략해도 된다.
//   node scripts/import-rule-scene.mjs <봉투.json> <출력.scene.ts> --title '2-4 골킥' --check
//       쓰지 않고, 이미 있는 파일과 일치하는지만 검증한다(드리프트·손편집 탐지).
//   node scripts/import-rule-scene.mjs <봉투.json> <출력.scene.ts> --title '2-6 간접FK' --situation indirect-fk
//       봉투의 `situation` 을 그 값으로 **바꿔서** 찍는다(아래 `--situation` 절 참조).
//
// **왜 `--situation` 이라는 예외가 있나** (2026-08-31): 편집기 UI 가 상황을 잘못 고르게 두면
// 봉투에 오라벨이 실린다 — 실제로 `2-6 간접FK`·`2-7 패널티킥` 두 벌이 `situation:'direct-fk'`
// 로 저장돼 있었다(스키마에는 `indirect-fk`·`penalty` 가 엄연히 있다, model/drill.ts).
// 이걸 찍힌 파일에서 손으로 고치면 위 `--check` 가 **영구히 불일치**로 떨어져 드리프트 탐지가
// 죽는다. 그래서 사람이 파일을 만지는 대신 **찍는 단계에서** 값을 갈고, 무엇을 갈았는지 파일
// 머리말과 재실행 명령에 남긴다 — 그러면 `--check` 가 계속 산다.
// 넓히지 않는 이유: 임의 필드를 갈 수 있게 열면 "Claude 는 파이프라인만"(계획 §1.3)이 무너진다.
// 좌표·노트·타이밍은 여기서 못 건드린다. 다른 필드에 같은 문제가 생기면 그때 그 필드만 연다.
//
// **`.json` + import 가 아니라 `.ts` 를 찍는 이유**: `tsconfig.app.json` 에 `resolveJsonModule`
// 이 없어 빌드 설정을 건드려야 하고, `satisfies Drill` 이 필드 이름·타입의 오탈자를 컴파일 시점에
// 잡아 준다(`.json` 이면 임포트 지점까지 아무도 안 본다).
//
// ⚠️ 다만 **스키마 번호가 올라가는 날을 `satisfies` 가 잡아 주지는 않는다**(2026-08-31 정정).
// 이 머리말은 오래 *"`satisfies Drill` 이라야 스키마가 올라가는 날 컴파일 오류로 알려 준다"* 고
// 적어 왔지만 `Drill.schemaVersion` 은 리터럴 9 가 아니라 `number` 다(src/model/drill.ts:351) —
// 찍힌 `schemaVersion: 9` 는 `CURRENT_DRILL_SCHEMA` 가 10이 되어도 그대로 통과한다.
// **컴파일러는 못 잡는다** — 그 자리는 `src/features/rules/ruleScenes.test.ts` 의
// *"schemaVersion 도장이 CURRENT_DRILL_SCHEMA 와 같다"* 단언이 대신 선다. 장면은 저장 대상이
// 아니라 `migrateDoc` 을 타지 않고, 그래서 마이그레이션도 too-new 거절 보호도 못 받는다.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// src/storage/transfer.ts 의 ENVELOPE_VERSION. 하드코딩인 이유는 그 파일이 `.ts` 라 노드가
// 로더 없이 못 읽어서다 — 값이 올라가면 아래 검사가 먼저 걸린다(그때 같이 올린다).
const ENVELOPE_VERSION = 1;

// `teams` 를 원본 그대로 굳히지 않는 이유: 규칙 도해는 **앱 기본 팀색·팀이름**으로 떠야 하는데,
// 봉투는 드릴을 만든 기기의 설정을 들고 온다. 값을 여기 베껴 적으면 defaults.ts 와 조용히
// 어긋나므로, 값이 아니라 상수 참조를 찍는다.
const TEAMS_SENTINEL = '__SPIN_DEFAULT_TEAMS__';
const TEAMS_EXPR = '{ home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } }';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// ---- 인자 ------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const list = argv.includes('--list');
// 값을 받는 플래그들. 인덱스를 모아 두는 이유는 아래 positional 에서 **값 자리를 빼야** 하기
// 때문이다 — at<0 일 때 at+1 은 0 이라, 가드 없이 쓰면 첫 인자(입력 경로)가 사라진다.
const valueAts = [];
function valueOf(flag, missing) {
  const at = argv.indexOf(flag);
  if (at < 0) return undefined;
  if (argv[at + 1] === undefined) die(missing);
  valueAts.push(at + 1);
  return argv[at + 1];
}
const wantTitle = valueOf('--title', '--title 뒤에 드릴 제목이 없다');
const setSituation = valueOf('--situation', '--situation 뒤에 상황 값이 없다');
const positional = argv.filter((a, i) => !a.startsWith('--') && !valueAts.includes(i));

const [inPath, outPath] = positional;
if (inPath === undefined) die('입력 봉투(.json) 경로가 없다');
if (!list && outPath === undefined) die('출력(.scene.ts) 경로가 없다 — 목록만 보려면 --list');

// ---- 봉투 열기 -------------------------------------------------------------------------------
let file;
try {
  file = JSON.parse(readFileSync(resolve(inPath), 'utf8'));
} catch (e) {
  die(`봉투를 읽지 못했다: ${e.message}`);
}
// transfer.ts parseSpinFile 과 같은 최소 검사. 봉투가 아닌 파일을 드릴로 착각해 쓰지 않으려는 것.
if (file === null || typeof file !== 'object' || Array.isArray(file)) die('봉투가 객체가 아니다');
if (typeof file.spin !== 'string' || typeof file.envelope !== 'number' || !('payload' in file)) {
  die('SPIN 봉투가 아니다 — spin·envelope·payload 가 필요하다');
}
if (file.envelope > ENVELOPE_VERSION) {
  die(`봉투 버전이 너무 새롭다: ${file.envelope} > ${ENVELOPE_VERSION} — 이 스크립트를 먼저 올려라`);
}

// 드릴이 들어 있는 kind 만 받는다. session·library 도 드릴을 들고 있지만 규칙 장면의 출처는
// "편집기에서 내보낸 드릴" 아니면 "기기 백업" 둘뿐이라, 넓히지 않고 필요할 때 넓힌다.
let drills;
if (file.spin === 'drill') drills = [file.payload];
else if (file.spin === 'backup') drills = file.payload?.drills;
else die(`지원하지 않는 kind: ${file.spin} — drill 또는 backup 이어야 한다`);
if (!Array.isArray(drills) || drills.length === 0) die('봉투 안에 드릴이 없다');

const label = (d) => `${d.title ?? '(제목 없음)'} — ${d.steps?.length ?? 0}스텝, ${d.courtMode}/${d.courtSize}`;

if (list) {
  for (const d of drills) console.log(`  ${label(d)}`);
  process.exit(0);
}

// ---- 드릴 고르기 -----------------------------------------------------------------------------
let picked;
if (wantTitle === undefined) {
  if (drills.length !== 1) {
    console.error(`드릴이 ${drills.length}개다 — --title 로 하나를 지목해라:`);
    for (const d of drills) console.error(`  ${label(d)}`);
    process.exit(1);
  }
  picked = drills[0];
} else {
  const hits = drills.filter((d) => d.title === wantTitle);
  if (hits.length === 0) die(`제목이 "${wantTitle}" 인 드릴이 없다 — --list 로 확인해라`);
  if (hits.length > 1) die(`제목이 "${wantTitle}" 인 드릴이 ${hits.length}개다 — 봉투 쪽에서 이름을 갈라라`);
  picked = hits[0];
}
if (typeof picked.schemaVersion !== 'number') die('고른 payload 에 schemaVersion 이 없다 — 드릴이 아니다');

// ---- situation 교정 --------------------------------------------------------------------------
// 값은 `DRILL_SITUATIONS` 에서 **읽어서** 검증한다(적어 두면 그 목록과 조용히 어긋난다).
// `.ts` 라 import 는 못 하고 정규식으로 그 배열만 긁는다 — 목록이 리터럴 한 덩이라 가능하다.
let situationNote;
if (setSituation !== undefined) {
  const src = readFileSync(resolve(ROOT, 'src/model/drill.ts'), 'utf8');
  const block = /export const DRILL_SITUATIONS = \[([^\]]*)\]/.exec(src);
  if (block === null) die('src/model/drill.ts 에서 DRILL_SITUATIONS 를 못 찾았다 — 스크립트를 고쳐라');
  const allowed = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (!allowed.includes(setSituation)) die(`situation 값이 스키마에 없다: ${setSituation} — 가능한 값: ${allowed.join(', ')}`);
  if (picked.situation === setSituation) die(`--situation ${setSituation} 은 봉투 값과 같다 — 고칠 것이 없으면 플래그를 빼라`);
  situationNote = picked.situation ?? '(없음)';
  picked = { ...picked, situation: setSituation };
}

// ---- 파일 찍기 -------------------------------------------------------------------------------
const outAbs = resolve(outPath);
const importPath = (target) => {
  const p = relative(dirname(outAbs), resolve(ROOT, target)).replaceAll('\\', '/');
  return p.startsWith('.') ? p : `./${p}`;
};

const body = JSON.stringify({ ...picked, teams: TEAMS_SENTINEL }, null, 2).replace(`"${TEAMS_SENTINEL}"`, TEAMS_EXPR);

// 재실행 명령의 경로는 **저장소 루트 기준으로 정규화**해서 적는다. 호출자가 절대경로로 부르든
// 상대경로로 부르든 찍히는 글자가 같아야 `--check` 가 산다 — 안 그러면 부르는 방식만 달라도
// 이 줄이 어긋나 "손편집됐다"고 거짓 경보한다(실제로 그렇게 12개가 전부 불일치로 떨어졌다).
const asRel = (p) => relative(ROOT, resolve(p)).replaceAll('\\', '/');
const rerun = `node scripts/import-rule-scene.mjs ${asRel(inPath)} ${asRel(outPath)}${wantTitle === undefined ? '' : ` --title '${wantTitle}'`}${setSituation === undefined ? '' : ` --situation ${setSituation}`}`;
const fixLine =
  situationNote === undefined
    ? ''
    : `//
// ⚠️ 교정 1건: \`situation\` 을 ${situationNote} → ${setSituation} 로 바꿔 찍었다. 편집기에서 상황을
// 잘못 고른 채 저장된 값이고, 스키마(model/drill.ts DRILL_SITUATIONS)에 옳은 값이 이미 있다.
// **고친 것은 이 임베드 사본뿐이다 — 기현님 라이브러리의 원본 드릴은 건드리지 않았다.**
// 좌표·노트·타이밍은 한 글자도 바뀌지 않았다(스크립트가 \`situation\` 말고는 갈지 못한다).
`;
const text = `// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "${picked.title}"(schemaVersion ${picked.schemaVersion}, ${picked.steps?.length ?? 0}스텝,
// ${picked.courtMode}/${picked.courtSize}). 봉투의 \`teams\` 는 만든 기기의 설정이라 버리고
// \`DEFAULT_TEAMS\` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
${fixLine}//
//   다시 찍기: ${rerun}
//   드리프트 검사: ${rerun} --check
import { DEFAULT_TEAMS } from '${importPath('src/model/defaults.ts')}';
import type { Drill } from '${importPath('src/model/drill.ts')}';

export const drill = ${body} satisfies Drill;
`;

if (check) {
  let have;
  try {
    have = readFileSync(outAbs, 'utf8');
  } catch {
    die(`${outPath} 이 없다 — --check 는 이미 찍힌 파일과 대조한다`);
  }
  if (have === text) {
    console.log(`일치 — ${picked.title}, ${picked.steps?.length ?? 0}스텝`);
  } else {
    const a = have.split('\n');
    const b = text.split('\n');
    const bad = b.findIndex((l, i) => l !== a[i]);
    console.error(`불일치: 줄 수 ${a.length}/${b.length}, 첫 어긋난 줄 ${bad + 1}`);
    if (bad >= 0) {
      console.error(`  파일: ${a[bad] ?? '(끝)'}`);
      console.error(`  봉투: ${b[bad] ?? '(끝)'}`);
    }
    process.exit(1);
  }
} else {
  writeFileSync(outAbs, text);
  console.log(`찍었다 — ${outPath}: "${picked.title}", ${picked.steps?.length ?? 0}스텝, ${picked.courtMode}/${picked.courtSize}`);
  console.log(`버린 teams(원본): ${JSON.stringify(picked.teams)}`);
}
