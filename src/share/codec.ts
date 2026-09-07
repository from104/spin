// 공유 링크의 평문 — 드릴을 접고 펴는 자리 (PLAN-SHARE-LINK 결정 1·8, PLAN-URL-SHARE 결정 1·4·5).
//
// **새 포맷을 만들지 않는다.** 평문은 `exportDrillFile` 이 만드는 그 봉투 JSON 그대로다
// (PLAN-URL-SHARE §1.1). 그래서 이 파일은 봉투를 **읽지도 고치지도 않고** 접기만 하고, 펴는 쪽은
// `parseSpinFile → migrateDoc → validateDrill` 이라는 **이미 있는 관문**에 그대로 넣는다 —
// 마이그레이션 사다리(v1→v11)와 검증 1,151줄을 공짜로 물려받는다. 봉투를 여기서 손으로 지으면
// 그 사다리가 두 벌이 된다.
//
// ⚠️ **검증 우회로를 내지 마라**(PLAN-URL-SHARE 결정 4). 이 함수에 들어오는 바이트는 낯선
// 사람이 보낸 것이다. validate.ts 가 이 앱의 신뢰 경계이고, 공유가 그 옆에 난 뒷문이 되면 안 된다.
// ⚠️ **압축 폭탄**(결정 5). deflate 는 1000:1 이 나온다 — 펴는 중 1 MiB 를 넘으면 그 자리에서
// 끊는다. 다 편 뒤에 길이를 재면 이미 늦다(그 사이 탭이 죽는다).
//
// 첫 바이트 `0x01` = deflate-raw JSON. PoB 의 유일한 실책이 코드에 표식이 없어 포맷을 못 바꾼 것이라
// (PLAN-URL-SHARE 결정 3) 한 바이트를 미리 낸다 — 훗날 다른 코덱을 **깨지 않고** 열 자리다.
import type { Drill } from '../model/drill.ts';
import { CURRENT_DRILL_SCHEMA } from '../model/drill.ts';
import { exportDrillFile, parseSpinFile, type SpinFile } from '../storage/transfer.ts';
import { migrateDoc, DRILL_MIGRATIONS } from '../model/migrate.ts';
import { validateDrill } from '../model/validate.ts';
import { StorageError } from '../storage/errors.ts';
import { ShareError, type ShareBytes } from './api.ts';

/** 코덱 표식 — 1바이트. 값이 늘면 여기 상수를 늘리고 decode 의 분기를 늘린다. */
export const SHARE_CODEC_DEFLATE_RAW = 0x01;

/** 펴는 중 상한(결정 5). 실제 드릴은 최대 4 KB 짜리 코드가 ~12 KB JSON 으로 펴진다 —
 *  1 MiB 는 그보다 두 자릿수 위라 정상 문서를 자르지 않는다. */
export const SHARE_MAX_INFLATED_BYTES = 1024 * 1024;

export interface EncodeDrillOptions {
  /** 결정 8 — 선수 실명(`ChairDef.name`)과 팀 이름(`teams.*.label`)을 빼고 접는다.
   *  받는 코치의 선수는 다른 사람이라 뜻이 없고, 링크는 회수가 안 된다. */
  stripNames?: boolean;
}

/** 이름을 지운다. **키를 지우지 값을 비우지 않는다** — `label: ''` 로 두면 받는 쪽 validate 가
 *  그 빈 문자열을 그대로 살려(sanitizeText 는 길이만 본다) 팀 이름 없는 드릴이 되고, 키가 없으면
 *  `DEFAULT_TEAMS` 의 기본 이름으로 떨어진다. 후자가 받는 사람에게 뜻이 있는 상태다.
 *
 *  대상은 **파싱해 낸 봉투 사본**이다(호출자의 Drill 이 아니다) — 원본 불변을 규약이 아니라
 *  구조로 보장하려는 것이다. JSON.parse 가 이미 사본을 낳았으므로 여기서 지우는 것은 남의 것이
 *  아니다. 그래서 `TeamStyle.label` 이 필수 필드인데도 타입 거짓말 없이 지울 수 있다. */
function stripNamesFromPayload(payload: unknown): void {
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

/** 드릴 하나 → 서버에 올릴 **평문** 바이트(암호는 crypto.ts 가 건다).
 *
 *  압축이 스트림 API 라 비동기다 — 계획서의 시그니처 표기는 반환 바이트의 모양을 가리킨 것이고,
 *  실제 호출부(index.ts `createShareLink`)는 await 한다. */
export async function encodeDrillPayload(drill: Drill, options: EncodeDrillOptions = {}): Promise<ShareBytes> {
  const text = await exportDrillFile(drill).text();
  let json = text;
  if (options.stripNames) {
    const envelope = JSON.parse(text) as { payload?: unknown };
    stripNamesFromPayload(envelope.payload);
    json = JSON.stringify(envelope);
  }
  const body = await deflateRaw(new TextEncoder().encode(json));
  const out = new Uint8Array(body.length + 1);
  out[0] = SHARE_CODEC_DEFLATE_RAW;
  out.set(body, 1);
  return out;
}

/** 평문 바이트 → 검증까지 통과한 Drill. 실패는 전부 `ShareError` 다(호출자가 kind 로 문구를 고른다). */
export async function decodeDrillPayload(bytes: ShareBytes): Promise<Drill> {
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
  if (file.spin !== 'drill') throw new ShareError('invalid');

  const mig = migrateDoc(file.payload, DRILL_MIGRATIONS, CURRENT_DRILL_SCHEMA);
  if (!mig.ok) throw new ShareError(mig.reason === 'too-new' ? 'too-new' : 'invalid');
  const v = validateDrill(mig.doc);
  if (!v.ok) throw new ShareError('invalid');
  return v.value;
}
