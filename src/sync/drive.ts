// 0.6 Drive 동기화 — Drive REST v3 를 **순수 fetch** 로 부른다. gapi SDK 는 넣지 않는다
// (DESIGN.md "런타임 스키마 라이브러리 도입 금지" 와 같은 결 — 의존성 0 이 이 앱의 방침이고,
// 필요한 호출이 네 가지뿐이라 SDK 는 몸집만 크다): 목록·multipart 올리기·alt=media 내려받기·삭제.
//
// 토큰은 인자로 받는다 — 수명 관리는 auth.ts(커밋 4)의 몫이고, 이 모듈은 "토큰 하나로 요청
// 하나" 만 안다. 그래서 fetch 스텁만으로 전부 테스트된다.
//
// 원격 레이아웃(계획서 §원격 레이아웃): appDataFolder 에 문서별 파일 `<id>.json`(id 가 이미
// dr_/se_/tm_ 접두를 갖고 있고 roster 는 'roster'). 파일 목록의 appProperties 만으로 계획을
// 세우고(planSync), 본문은 pull 로 확정된 문서만 내려받는다.
//   appProperties: { t: type, id, m: 수정 ms, d?: 삭제 ms, w?: writerId }  — 값은 전부 문자열(Drive 제약)
//   본문(자기서술 컨테이너): { sync: 1, type, id, modifiedAt, deletedAt?, writerId?, doc | null }
// 톰스톤은 **같은 파일을 doc:null 로 갱신**한 것이다 — 파일을 지우면 "원격에 없음 = 미업로드
// 신규" 와 구별할 수 없다.
import { StorageError, STORAGE_ERROR_MESSAGES } from '../storage/errors.ts';
import type { SyncDocType } from '../storage/syncMeta.ts';
import type { PlanRemoteFile } from './plan.ts';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** 컨테이너 포맷 버전. 문서 자체의 schemaVersion 과 별개다 — 이건 "동기화 봉투" 의 버전이고,
 *  문서는 원형 그대로 실려 pull 쪽에서 기존 migrateDoc+validate 관문을 지난다. */
export const SYNC_CONTAINER_VERSION = 1;

export interface SyncContainer {
  sync: number;
  type: SyncDocType;
  id: string;
  modifiedAt: number;
  deletedAt?: number;
  writerId?: string;
  /** null = 톰스톤. */
  doc: unknown;
}

export type ContainerParse = { ok: true; container: SyncContainer } | { ok: false; reason: 'too-new' | 'invalid' };

/** 내려받은 본문의 관문. too-new(sync 버전이 더 높음)는 invalid 와 갈라 보고한다 — 처리가
 *  다르기 때문이다: too-new 는 "앱 업데이트 필요"(문서 단위 스킵, 절대 다운그레이드 안 함),
 *  invalid 는 손상. */
export function parseSyncContainer(v: unknown): ContainerParse {
  if (!v || typeof v !== 'object') return { ok: false, reason: 'invalid' };
  const r = v as Record<string, unknown>;
  if (typeof r.sync !== 'number') return { ok: false, reason: 'invalid' };
  if (r.sync > SYNC_CONTAINER_VERSION) return { ok: false, reason: 'too-new' };
  // ⚠️ 이 목록이 곧 «이 앱이 아는 종류» 다. 새 종류(2026-09-09 'team')를 여기 빠뜨리면 그 파일이
  //    invalid 로 떨어져, 받는 기기는 손상으로 오해하고 영원히 안 받는다. 반대로 **옛 기기**가
  //    team 파일을 여기서 invalid 로 떨구는 것은 의도된 안전이다 — 모르는 것을 지우거나
  //    덮어쓰지 않고 그냥 지나간다(결정 14).
  if (r.type !== 'drill' && r.type !== 'session' && r.type !== 'roster' && r.type !== 'team') return { ok: false, reason: 'invalid' };
  if (typeof r.id !== 'string' || r.id.length === 0) return { ok: false, reason: 'invalid' };
  if (typeof r.modifiedAt !== 'number') return { ok: false, reason: 'invalid' };
  if (r.deletedAt !== undefined && typeof r.deletedAt !== 'number') return { ok: false, reason: 'invalid' };
  if (!('doc' in r)) return { ok: false, reason: 'invalid' };
  return { ok: true, container: r as unknown as SyncContainer };
}

// ── HTTP 공통 ─────────────────────────────────────────────────────────────────────────

/** 상태코드 → StorageError. 401 은 토큰 만료/회수(재연결로 풀림), 403 은 사유를 봐야 한다 —
 *  storageQuotaExceeded 는 사용자 Drive 용량 문제라 안내가 완전히 다르다. 429·5xx 는
 *  재시도 가치가 있는 원격 사정(엔진이 백오프한다)이라 하나로 접는다. */
async function toSyncError(res: Response): Promise<StorageError> {
  let reason = '';
  try {
    const j = (await res.json()) as {
      error?: { errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }>; status?: string; message?: string };
    };
    reason = j.error?.errors?.[0]?.reason ?? j.error?.details?.[0]?.reason ?? j.error?.status ?? '';
  } catch {
    /* 본문 없는 오류 응답 — 상태코드만으로 판정한다 */
  }
  if (res.status === 401) return new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH());
  if (res.status === 403 && /quota/i.test(reason)) return new StorageError('E_SYNC_QUOTA', STORAGE_ERROR_MESSAGES.E_SYNC_QUOTA());
  // Cloud 프로젝트에서 Drive API 자체가 꺼진 403 — "만료" 로 접으면 재연결을 아무리 해도
  // 그대로라 디버깅이 헛돈다(2026-08-20 실기에서 실제로 한 바퀴). 구버전 오류 본문은
  // reason:'accessNotConfigured', 신형은 status:'PERMISSION_DENIED'+details 의
  // SERVICE_DISABLED — 둘 다 여기서 받는다.
  if (res.status === 403 && /accessnotconfigured|service_disabled/i.test(reason)) {
    return new StorageError('E_SYNC_CONFIG', STORAGE_ERROR_MESSAGES.E_SYNC_CONFIG(), { detail: reason });
  }
  if (res.status === 403 && /ratelimit/i.test(reason)) {
    return new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { detail: `HTTP 403 ${reason}` });
  }
  if (res.status === 403) return new StorageError('E_SYNC_AUTH', STORAGE_ERROR_MESSAGES.E_SYNC_AUTH());
  return new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { detail: `HTTP ${res.status}${reason ? ` ${reason}` : ''}` });
}

async function driveFetch(token: string, url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
  } catch (e) {
    // fetch 자체의 거부는 전부 네트워크다(오프라인·DNS·CORS) — 응답이 있는 실패와 갈라야
    // 엔진이 "연결되면 자동 재개" 와 "재연결 필요" 를 다르게 말할 수 있다.
    throw new StorageError('E_SYNC_NETWORK', STORAGE_ERROR_MESSAGES.E_SYNC_NETWORK(), { cause: e });
  }
  if (!res.ok) throw await toSyncError(res);
  return res;
}

// ── 목록 ─────────────────────────────────────────────────────────────────────────────

interface ListedFile {
  id?: string;
  appProperties?: Record<string, string>;
}

/** appProperties → 계획 입력. 형식이 어긋난 파일(다른 버전·손상)은 files 에 넣지 않고
 *  unrecognized 로 따로 돌려준다 — 계획은 아는 것만으로 세우되, 모르는 파일이 있다는 사실
 *  자체는 삼키지 않는다(추후 GC·진단의 재료). */
function parseListed(f: ListedFile): PlanRemoteFile | null {
  const p = f.appProperties;
  if (!f.id || !p) return null;
  const t = p.t;
  if (t !== 'drill' && t !== 'session' && t !== 'roster' && t !== 'team') return null; // ★ parseSyncContainer 와 같은 목록이어야 한다
  if (!p.id) return null;
  const m = Number(p.m);
  if (!Number.isFinite(m)) return null;
  const d = p.d !== undefined ? Number(p.d) : undefined;
  if (d !== undefined && !Number.isFinite(d)) return null;
  return { fileId: f.id, type: t, id: p.id, modifiedAt: m, ...(d !== undefined ? { deletedAt: d } : {}), ...(p.w ? { writerId: p.w } : {}) };
}

/** appDataFolder 전량 목록 — 이 한 번의 호출이 곧 원격 인덱스다(매니페스트 없음). */
export async function driveListAll(token: string): Promise<{ files: PlanRemoteFile[]; unrecognized: string[] }> {
  const files: PlanRemoteFile[] = [];
  const unrecognized: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      pageSize: '1000',
      fields: 'nextPageToken,files(id,appProperties)',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await driveFetch(token, `${API}/files?${params}`);
    const body = (await res.json()) as { nextPageToken?: string; files?: ListedFile[] };
    for (const f of body.files ?? []) {
      const parsed = parseListed(f);
      if (parsed) files.push(parsed);
      else if (f.id) unrecognized.push(f.id);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);
  return { files, unrecognized };
}

// ── 본문 내려받기 ─────────────────────────────────────────────────────────────────────

export async function driveDownload(token: string, fileId: string): Promise<unknown> {
  const res = await driveFetch(token, `${API}/files/${encodeURIComponent(fileId)}?alt=media`);
  try {
    return (await res.json()) as unknown;
  } catch (e) {
    throw new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { cause: e, detail: 'JSON 아님' });
  }
}

// ── 올리기(생성·갱신 공용 multipart) ──────────────────────────────────────────────────

/** JSON.stringify 는 개행을 \n 리터럴로 이스케이프하므로 본문 어느 부분도 실제 CRLF 를
 *  담지 못한다 — multipart 경계는 줄 시작에서만 인식되니 고정 경계 문자열로 충돌이 없다. */
const BOUNDARY = 'spin-sync-3c9f1a';

function containerProperties(c: SyncContainer): Record<string, string> {
  return {
    t: c.type,
    id: c.id,
    m: String(c.modifiedAt),
    ...(c.deletedAt !== undefined ? { d: String(c.deletedAt) } : {}),
    ...(c.writerId ? { w: c.writerId } : {}),
  };
}

/** fileId 없으면 appDataFolder 에 생성, 있으면 그 파일을 갱신(톰스톤화 포함 — doc:null 로).
 *  appProperties 는 컨테이너에서 파생한다(두 곳에 따로 적으면 목록과 본문이 갈라진다). */
export async function driveUpload(token: string, opts: { fileId?: string; container: SyncContainer }): Promise<{ fileId: string }> {
  const { fileId, container } = opts;
  const metadata: Record<string, unknown> = { appProperties: containerProperties(container) };
  if (!fileId) {
    metadata.name = `${container.id}.json`;
    metadata.parents = ['appDataFolder'];
  }
  const body = [
    `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`,
    `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(container)}`,
    `--${BOUNDARY}--`,
  ].join('\r\n');
  const url = fileId
    ? `${UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id`;
  const res = await driveFetch(token, url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
    body,
  });
  const out = (await res.json().catch(() => ({}))) as { id?: string };
  if (!out.id) throw new StorageError('E_SYNC_REMOTE', STORAGE_ERROR_MESSAGES.E_SYNC_REMOTE(), { detail: '업로드 응답에 id 없음' });
  return { fileId: out.id };
}

// ── 삭제 ─────────────────────────────────────────────────────────────────────────────

/** 실삭제 — 중복 정리(dropRemoteDup)·톰스톤 GC·[Drive 데이터 삭제] 전용. 문서의 삭제 전파는
 *  이걸 쓰지 않는다(톰스톤 = driveUpload 로 doc:null). 404 는 성공으로 접는다 — 다른 기기가
 *  먼저 지웠다면 목표 상태는 이미 달성돼 있다. */
export async function driveDelete(token: string, fileId: string): Promise<void> {
  try {
    await driveFetch(token, `${API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof StorageError && e.code === 'E_SYNC_REMOTE' && e.detail?.startsWith('HTTP 404')) return;
    throw e;
  }
}

/** [Drive 데이터 삭제] — appDataFolder 전량 실삭제. **unrecognized(형식을 모르는 파일)까지
 *  포함한다**: 프라이버시 청소가 목적이라 "우리가 못 읽는 파일" 이야말로 남기면 안 된다.
 *  지운 파일 수를 돌려준다(사용자 확인용). */
export async function driveWipeAll(token: string): Promise<number> {
  const { files, unrecognized } = await driveListAll(token);
  const ids = [...files.map((f) => f.fileId), ...unrecognized];
  for (const id of ids) await driveDelete(token, id);
  return ids.length;
}
