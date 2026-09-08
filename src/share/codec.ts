// 공유 링크의 평문 — 드릴·세션을 접고 펴는 자리 (PLAN-SHARE-LINK 결정 1·8 · §6 S1·S2·S5,
// PLAN-URL-SHARE 결정 1·4·5).
//
// **새 포맷을 만들지 않는다.** 평문은 `exportDrillFile` 이 만드는 그 봉투 JSON 그대로다
// (PLAN-URL-SHARE §1.1). 그래서 이 파일은 봉투를 **읽지도 고치지도 않고** 접기만 하고, 펴는 쪽은
// `parseSpinFile → migrateDoc → validateDrill/validateSession` 이라는 **이미 있는 관문**에 그대로 넣는다 —
// 마이그레이션 사다리(v1→v11)와 검증 1,151줄을 공짜로 물려받는다. 봉투를 여기서 손으로 지으면
// 그 사다리가 두 벌이 된다.
//
// ⚠️ **검증 우회로를 내지 마라**(PLAN-URL-SHARE 결정 4). 이 함수에 들어오는 바이트는 낯선
// 사람이 보낸 것이다. validate.ts 가 이 앱의 신뢰 경계이고, 공유가 그 옆에 난 뒷문이 되면 안 된다.
// ⚠️ **압축 폭탄**(결정 5). deflate 는 1000:1 이 나온다 — 펴는 중 상한(아래 상수)을 넘으면 그 자리에서
// 끊는다. 다 편 뒤에 길이를 재면 이미 늦다(그 사이 탭이 죽는다).
//
// 첫 바이트 `0x01` = deflate-raw JSON. PoB 의 유일한 실책이 코드에 표식이 없어 포맷을 못 바꾼 것이라
// (PLAN-URL-SHARE 결정 3) 한 바이트를 미리 낸다 — 훗날 다른 코덱을 **깨지 않고** 열 자리다.
//
// ── 세션도 같은 봉투로 (2026-09-08, PLAN-SHARE-LINK §6 결정 S1·S2·S5) ─────────────────────
// 링크가 싣는 것은 이제 둘이다: `exportDrillFile` 봉투(`spin:'drill'`)와 `exportSessionFile`
// 봉투(`spin:'session'` — 세션 1개 + 그 세션이 쓰는 드릴들). **종류를 링크 꼴이 아니라 봉투가
// 말한다**(S5) — 그래서 이 파일의 디코더는 하나이고, 무엇이 실려 왔는지는 반환값의 `kind` 가
// 알려 준다. 링크 꼴을 둘로 나누면 잘못된 꼴로 붙여넣은 사람에게 할 말이 "이 링크는 세션용이
// 아닙니다" 밖에 안 남는다.
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import type { TrainingSession } from '../model/session.ts';
import { CURRENT_SESSION_SCHEMA } from '../model/session.ts';
import { exportDrillFile, exportSessionFile, parseSpinFile, type SpinFile } from '../storage/transfer.ts';
import { migrateDoc, DRILL_MIGRATIONS, SESSION_MIGRATIONS } from '../model/migrate.ts';
import { validateDrill, validateSession } from '../model/validate.ts';
import { StorageError } from '../storage/errors.ts';
import { ShareError, type ShareBytes } from './api.ts';

/** 코덱 표식 — 1바이트. 값이 늘면 여기 상수를 늘리고 decode 의 분기를 늘린다. */
export const SHARE_CODEC_DEFLATE_RAW = 0x01;

/** 펴는 중 상한(결정 5). 실제 드릴은 최대 4 KB 짜리 코드가 ~12 KB JSON 으로 펴진다 —
 *  1 MiB 는 그보다 두 자릿수 위라 정상 문서를 자르지 않는다.
 *
 *  ── ⚠️ 2026-09-08: 1 MiB → 4 MiB (PLAN-SHARE-LINK 결정 S3 로 본문 상한이 64 KiB → 256 KiB) ──
 *  위 «두 자릿수 위» 는 드릴 하나만 실을 때의 셈이었다. 세션은 드릴 N개를 데리고 오므로 상한
 *  256 KiB 를 꽉 채운 암호문이 압축비 4:1 만 돼도 1 MiB 에 닿는다 — 그대로 두면 이 상한이
 *  폭탄 방어선이 아니라 **정상 세션을 자르는 크기 제한**이 된다(크기 제한은 업로드 상한 한
 *  곳에만 있어야 한다). 폭탄 방어는 그대로다: deflate 의 1000:1 은 256 MiB 를 낳는다. */
export const SHARE_MAX_INFLATED_BYTES = 4 * 1024 * 1024;

/** 링크가 싣는 문서. **접는 쪽과 펴는 쪽이 같은 모양을 쓴다** — 넣은 것과 나오는 것이 다른
 *  이름이면 호출자가 둘 사이를 옮겨 적는 코드를 쓰게 되고, 그 자리가 종류를 잃어버리는 자리다.
 *  세션은 드릴을 **데리고** 다닌다(S1: `exportSessionFile(session, drills)` 봉투 그대로).
 *
 *  ⚠️ **팀([팀] 메뉴)은 이 유니온에 없다 — 넣지 마라**(PLAN-TEAM.md 결정 12, 기현 지시
 *  2026-09-09: *"기기 저장, 구글 드라이브 동기화, 파일 내보내기만 허용, 공유 링크 없음"*).
 *  팀 문서는 선수 실명·등급·메모가 모인 곳이고 링크는 한 번 나가면 회수가 안 된다. 닫힌
 *  유니온이 그 울타리의 **컴파일 타임 방어**다: 팀을 링크로 보내려면 여기 한 줄을 더해야
 *  하고, 그 한 줄이 곧 이 결정을 뒤집는 자리다. */
export type SharedDoc =
  | { kind: 'drill'; drill: Drill }
  | { kind: 'session'; session: TrainingSession; drills: Drill[] };

export interface EncodeShareOptions {
  /** 결정 8 · S2 — 개인 식별 정보를 빼고 접는다: 선수 실명(`ChairDef.name`) · 팀 이름
   *  (`teams.*.label`) · 세션 참가자 명단(`participantIds`) · 세션의 팀 지목(`teamId`, 2026-09-09).
   *  받는 코치의 선수는 다른 사람이라
   *  뜻이 없고, 링크는 회수가 안 된다. 장소·메모는 **남긴다**(S2) — 그건 코치가 쓴 내용이다.
   *
   *  ⚠️ 2026-09-08: 이름이 `stripNames` 에서 `strip` 으로 바뀌었다. 지우는 것이 이름만이 아니게
   *  됐는데 이름이 그대로면, 다음 사람이 "명단은 안 지우는군" 이라고 읽는다. */
  strip?: boolean;
}

/** 이름을 지운다. **키를 지우지 값을 비우지 않는다** — `label: ''` 로 두면 받는 쪽 validate 가
 *  그 빈 문자열을 그대로 살려(sanitizeText 는 길이만 본다) 팀 이름 없는 드릴이 되고, 키가 없으면
 *  `DEFAULT_TEAMS` 의 기본 이름으로 떨어진다. 후자가 받는 사람에게 뜻이 있는 상태다.
 *
 *  대상은 **파싱해 낸 봉투 사본**이다(호출자의 Drill 이 아니다) — 원본 불변을 규약이 아니라
 *  구조로 보장하려는 것이다. JSON.parse 가 이미 사본을 낳았으므로 여기서 지우는 것은 남의 것이
 *  아니다. 그래서 `TeamStyle.label` 이 필수 필드인데도 타입 거짓말 없이 지울 수 있다. */
function stripNamesFromDrillPayload(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null) return;
  const doc = payload as Record<string, unknown>;
  const cast = doc.cast as { chairs?: unknown } | undefined;
  if (cast && Array.isArray(cast.chairs)) {
    for (const chair of cast.chairs as Record<string, unknown>[]) {
      if (chair && typeof chair === 'object') delete chair.name;
    }
  }
  const teams = doc.teams as Record<string, unknown> | undefined;
  if (teams && typeof teams === 'object') {
    for (const side of Object.keys(teams)) {
      const style = teams[side];
      if (style && typeof style === 'object') delete (style as Record<string, unknown>).label;
    }
  }
}

/** 세션 봉투(S2) — 참가자 명단을 지우고, 데리고 온 드릴마다 위 지우개를 돌린다.
 *
 *  ⚠️ **명단은 키째로 지운다.** `participantIds: []` 로 두면 받는 쪽 validate 가 빈 배열을
 *  "참가자 0명으로 지정됨" 이 아니라 미지정으로 접기는 하지만(길이 0 이면 키를 안 만든다),
 *  봉투 JSON 에는 보내는 팀이 명단 기능을 쓴다는 사실이 남는다. 지울 것은 그 사실까지다.
 *  장소(`location`)·메모(`note`)·항목 메모는 건드리지 않는다 — 공유 모달이 "장소·메모가
 *  포함됩니다" 라고 말하는 근거가 이 줄이다(S2). */
function stripSessionPayload(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null) return;
  const doc = payload as { session?: unknown; drills?: unknown };
  if (doc.session && typeof doc.session === 'object') {
    delete (doc.session as Record<string, unknown>).participantIds;
    // 2026-09-09 — 팀 지목도 지운다(PLAN-TEAM.md 결정 12). **팀은 링크로 나가지 않는다**:
    // `SharedDoc` 유니온에 team 종류가 없으므로 받는 쪽에는 그 팀이 아예 존재하지 않고, 남은
    // `teamId` 는 «없는 문서를 가리키는 죽은 참조» 이면서 동시에 보내는 팀이 팀 기능을 쓴다는
    // 사실을 남긴다. participantIds 와 정확히 같은 이유로 **키째** 지운다.
    delete (doc.session as Record<string, unknown>).teamId;
  }
  if (Array.isArray(doc.drills)) for (const drill of doc.drills) stripNamesFromDrillPayload(drill);
}

async function deflateRaw(bytes: ShareBytes): Promise<ShareBytes> {
  // ⚠️ Blob.stream() 을 쓰지 마라 — jsdom 이 구현하지 않아 테스트 전체가 이 한 줄로 죽는다.
  const src = new ReadableStream<ShareBytes>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  return concat(await drain(src.pipeThrough(new CompressionStream('deflate-raw'))));
}

async function drain(stream: ReadableStream<ShareBytes>): Promise<ShareBytes[]> {
  const reader = stream.getReader();
  const chunks: ShareBytes[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return chunks;
}

function concat(chunks: ShareBytes[]): ShareBytes {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** 상한을 **펴는 도중에** 건다. 넘으면 스트림을 취소하고 'too-large' 로 끊는다 — 남은 바이트를
 *  계속 펴지 않는 것이 이 함수의 전부다(결정 5). 깨진 코드는 DecompressionStream 이 시끄럽게
 *  던지므로(Z_BUF_ERROR) 조용한 통과가 없다. */
async function inflateRawCapped(bytes: ShareBytes, max: number): Promise<ShareBytes> {
  const src = new ReadableStream<ShareBytes>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  const reader = src.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: ShareBytes[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new ShareError('too-large');
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof ShareError) throw e;
    throw new ShareError('invalid', { cause: e });
  }
  return concat(chunks);
}

/** 문서 하나 → 서버에 올릴 **평문** 바이트(암호는 crypto.ts 가 건다).
 *
 *  압축이 스트림 API 라 비동기다 — 계획서의 시그니처 표기는 반환 바이트의 모양을 가리킨 것이고,
 *  실제 호출부(index.ts `createShareLink`)는 await 한다.
 *
 *  ⚠️ 봉투는 `exportDrillFile`/`exportSessionFile` 이 짓는다. 여기서 손으로 지으면 파일
 *  내보내기와 링크가 **서로 다른 봉투**를 내게 되고, 그 차이는 받는 쪽에서만 드러난다. */
export async function encodeSharePayload(doc: SharedDoc, options: EncodeShareOptions = {}): Promise<ShareBytes> {
  const blob = doc.kind === 'drill' ? exportDrillFile(doc.drill) : exportSessionFile(doc.session, doc.drills);
  const text = await blob.text();
  let json = text;
  if (options.strip) {
    const envelope = JSON.parse(text) as { payload?: unknown };
    // 종류는 봉투를 다시 읽지 않고 **호출자가 준 kind** 로 가른다 — 방금 우리가 지은 봉투라
    // 되읽는 것은 한 번 더 틀릴 기회일 뿐이다.
    if (doc.kind === 'drill') stripNamesFromDrillPayload(envelope.payload);
    else stripSessionPayload(envelope.payload);
    json = JSON.stringify(envelope);
  }
  const body = await deflateRaw(new TextEncoder().encode(json));
  const out = new Uint8Array(body.length + 1);
  out[0] = SHARE_CODEC_DEFLATE_RAW;
  out.set(body, 1);
  return out;
}

/** 낯선 사람이 보낸 드릴 하나를 관문에 통과시킨다(마이그레이션 → 검증). 실패는 `ShareError`. */
function acceptDrill(payload: unknown): Drill {
  const mig = migrateDoc(payload, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  if (!mig.ok) throw new ShareError(mig.reason === 'too-new' ? 'too-new' : 'invalid');
  const v = validateDrill(mig.doc);
  if (!v.ok) throw new ShareError('invalid');
  return v.value;
}

/** 세션 봉투(S1) — 드릴들을 먼저 통과시키고 세션을 통과시킨다.
 *
 *  ⚠️ **드릴 하나라도 떨어지면 통째로 거절한다.** 파일 가져오기(`prepareSessionImport` →
 *  `prepareDrillCandidates`)는 손상 드릴을 조용히 빼고 나머지를 살리지만, 거기서는 그 차이를
 *  가져오기 보고의 세 숫자가 사용자에게 말해 준다. 링크에는 그 보고가 없다 — 조용히 빠지면
 *  코치는 항목 하나가 «누락» 으로 뜨는 세션을 받고 왜인지 영영 모른다. 부분 손상은 우리 쪽
 *  버그이거나 훼손된 암호문이라, 링크를 다시 받는 것이 옳은 처방이다. */
function acceptSession(payload: unknown): SharedDoc {
  if (typeof payload !== 'object' || payload === null) throw new ShareError('invalid');
  const p = payload as { session?: unknown; drills?: unknown };
  if (!Array.isArray(p.drills)) throw new ShareError('invalid');
  const drills = p.drills.map(acceptDrill);
  const mig = migrateDoc(p.session, SESSION_MIGRATIONS, CURRENT_SESSION_SCHEMA);
  if (!mig.ok) throw new ShareError(mig.reason === 'too-new' ? 'too-new' : 'invalid');
  const v = validateSession(mig.doc);
  if (!v.ok) throw new ShareError('invalid');
  return { kind: 'session', session: v.value, drills };
}

/** 평문 바이트 → 검증까지 통과한 문서. 실패는 전부 `ShareError` 다(호출자가 kind 로 문구를 고른다).
 *  무엇이 실려 왔는지는 반환값의 `kind` 가 말한다 — 호출자는 종류를 미리 알 필요가 없다. */
export async function decodeSharePayload(bytes: ShareBytes): Promise<SharedDoc> {
  if (bytes.byteLength < 2 || bytes[0] !== SHARE_CODEC_DEFLATE_RAW) throw new ShareError('invalid');
  const json = await inflateRawCapped(bytes.subarray(1), SHARE_MAX_INFLATED_BYTES);
  const text = new TextDecoder().decode(json);

  let file: SpinFile;
  try {
    file = parseSpinFile(text);
  } catch (e) {
    // 봉투가 이 앱보다 새로우면 "손상" 이 아니라 "앱이 낡았다" 다 — 사용자가 할 일이 다르다.
    if (e instanceof StorageError && e.code === 'E_SCHEMA_TOO_NEW') throw new ShareError('too-new', { cause: e });
    throw new ShareError('invalid', { cause: e });
  }
  // 공유 대상은 드릴 하나뿐이다(PLAN-URL-SHARE 결정 11). 세션·라이브러리 봉투가 실려 오면
  // 조용히 첫 드릴만 꺼내지 않고 거절한다 — 링크가 무엇을 실었는지 사람이 알아야 한다.
  // ── ⚠️ 2026-09-08: 위 문단의 «드릴 하나뿐» 은 PLAN-SHARE-LINK §6(결정 S1·S5)로 뒤집혔다 ──
  //    근거였던 "링크 하나에 드릴 N개를 실으면 QR 이 죽는다" 는 **긴 링크**의 제약이었고
  //    백엔드가 생기며 죽었다(링크에 실리는 것은 이제 id 10자 + 열쇠 43자뿐이다).
  //    **뒷문장은 안 죽었다** — 조용히 첫 드릴만 꺼내지 않는다는 규율은 그대로다. 달라진 것은
  //    세션 봉투에 대한 답이 «거절» 에서 «kind:'session' 으로 정직하게 알려 주기» 가 된 것뿐이고,
  //    library·prefs·backup·drillSet 봉투는 여전히 여기서 떨어진다.
  if (file.spin === 'drill') return { kind: 'drill', drill: acceptDrill(file.payload) };
  if (file.spin === 'session') return acceptSession(file.payload);
  throw new ShareError('invalid');
}
