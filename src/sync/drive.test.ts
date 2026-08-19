// 0.6 커밋 3 — drive.ts. 네트워크는 전부 vi.stubGlobal('fetch') — 여기서 못박는 것:
// ① 목록 페이지네이션과 appProperties 파싱(모르는 파일은 삼키지 않고 unrecognized 로)
// ② multipart 생성/갱신의 메서드·URL·본문 구성 ③ 상태코드 → E_SYNC_* 매핑
// ④ 컨테이너 관문(parseSyncContainer)의 too-new/invalid 구분 ⑤ 삭제의 404 관용.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { driveDelete, driveDownload, driveListAll, driveUpload, parseSyncContainer, type SyncContainer } from './drive.ts';

type FetchArgs = { url: string; init?: RequestInit };

/** 응답 대본을 순서대로 소비하는 fetch 스텁 — 호출 기록을 남긴다. */
function stubFetch(script: Array<Response | (() => Response)>): FetchArgs[] {
  const calls: FetchArgs[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const next = script.shift();
      if (!next) throw new Error('대본에 없는 fetch 호출');
      return typeof next === 'function' ? next() : next;
    }),
  );
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('driveListAll', () => {
  it('페이지를 전부 따라가고, appProperties 를 계획 입력으로 파싱하며, 모르는 파일은 unrecognized 로 분리한다', async () => {
    const calls = stubFetch([
      json({
        nextPageToken: 'p2',
        files: [
          { id: 'f1', appProperties: { t: 'drill', id: 'dr_a', m: '100', w: 'w1' } },
          { id: 'f2', appProperties: { t: 'session', id: 'se_b', m: '50', d: '70' } },
          { id: 'f-bad', appProperties: { t: 'mystery', id: 'x', m: '1' } },
        ],
      }),
      json({ files: [{ id: 'f3', appProperties: { t: 'roster', id: 'roster', m: '9' } }, { id: 'f-noprops' }] }),
    ]);
    const { files, unrecognized } = await driveListAll('tok');
    expect(files).toEqual([
      { fileId: 'f1', type: 'drill', id: 'dr_a', modifiedAt: 100, writerId: 'w1' },
      { fileId: 'f2', type: 'session', id: 'se_b', modifiedAt: 50, deletedAt: 70 },
      { fileId: 'f3', type: 'roster', id: 'roster', modifiedAt: 9 },
    ]);
    expect(unrecognized).toEqual(['f-bad', 'f-noprops']);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toContain('spaces=appDataFolder');
    expect(calls[0]!.url).not.toContain('pageToken');
    expect(calls[1]!.url).toContain('pageToken=p2');
    expect((calls[0]!.init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});

describe('driveUpload — multipart 생성/갱신', () => {
  const container: SyncContainer = { sync: 1, type: 'drill', id: 'dr_a', modifiedAt: 100, writerId: 'w1', doc: { title: '드릴' } };

  it('fileId 없으면 POST 생성 — appDataFolder 부모·이름·appProperties 를 싣는다', async () => {
    const calls = stubFetch([json({ id: 'new-file' })]);
    const out = await driveUpload('tok', { container });
    expect(out).toEqual({ fileId: 'new-file' });
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toContain('/upload/drive/v3/files?uploadType=multipart');
    const body = calls[0]!.init?.body as string;
    const [metaPart, contentPart] = body.split('\r\n--')!;
    expect(JSON.parse(metaPart!.split('\r\n\r\n')[1]!)).toEqual({
      appProperties: { t: 'drill', id: 'dr_a', m: '100', w: 'w1' },
      name: 'dr_a.json',
      parents: ['appDataFolder'],
    });
    expect(JSON.parse(contentPart!.split('\r\n\r\n')[1]!)).toEqual(container);
  });

  it('fileId 있으면 PATCH 갱신 — parents 를 다시 보내지 않고, 톰스톤(d)도 appProperties 에 실린다', async () => {
    const calls = stubFetch([json({ id: 'f9' })]);
    const tomb: SyncContainer = { sync: 1, type: 'drill', id: 'dr_a', modifiedAt: 100, deletedAt: 200, writerId: 'w1', doc: null };
    await driveUpload('tok', { fileId: 'f9', container: tomb });
    expect(calls[0]!.init?.method).toBe('PATCH');
    expect(calls[0]!.url).toContain('/upload/drive/v3/files/f9?uploadType=multipart');
    const meta = JSON.parse((calls[0]!.init?.body as string).split('\r\n--')[0]!.split('\r\n\r\n')[1]!) as Record<string, unknown>;
    expect(meta).toEqual({ appProperties: { t: 'drill', id: 'dr_a', m: '100', d: '200', w: 'w1' } });
  });
});

describe('오류 매핑 — 상태코드가 곧 사용자 안내의 갈림길', () => {
  it('401 → E_SYNC_AUTH(재연결), 403 quota → E_SYNC_QUOTA, 500 → E_SYNC_REMOTE, fetch 거부 → E_SYNC_NETWORK', async () => {
    stubFetch([json({ error: { message: 'x' } }, 401)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });

    stubFetch([json({ error: { errors: [{ reason: 'storageQuotaExceeded' }] } }, 403)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_QUOTA' });

    stubFetch([json({ error: { errors: [{ reason: 'backendError' }] } }, 500)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_REMOTE', detail: 'HTTP 500 backendError' });

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_NETWORK' });
  });

  it('403 권한(쿼터 아님) → E_SYNC_AUTH, 403 rateLimit → E_SYNC_REMOTE(재시도 가치)', async () => {
    stubFetch([json({ error: { errors: [{ reason: 'insufficientPermissions' }] } }, 403)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_AUTH' });
    stubFetch([json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 403)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_REMOTE' });
  });

  it('403 Drive API 미활성 → E_SYNC_CONFIG — "만료" 로 접으면 재연결을 아무리 해도 그대로다(실기에서 겪음)', async () => {
    // 구형 본문(errors[].reason)과 신형 본문(details[].reason) 둘 다.
    stubFetch([json({ error: { errors: [{ reason: 'accessNotConfigured' }] } }, 403)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_CONFIG', detail: 'accessNotConfigured' });
    stubFetch([json({ error: { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] } }, 403)]);
    await expect(driveListAll('t')).rejects.toMatchObject({ code: 'E_SYNC_CONFIG', detail: 'SERVICE_DISABLED' });
  });
});

describe('driveDownload · driveDelete', () => {
  it('alt=media 로 본문 JSON 을 돌려준다', async () => {
    const calls = stubFetch([json({ sync: 1, type: 'drill', id: 'dr_a', modifiedAt: 1, doc: {} })]);
    const body = await driveDownload('tok', 'f1');
    expect(calls[0]!.url).toContain('/files/f1?alt=media');
    expect((body as { id: string }).id).toBe('dr_a');
  });

  it('삭제의 404 는 성공이다 — 다른 기기가 먼저 지웠으면 목표 상태는 이미 달성', async () => {
    stubFetch([json({ error: { message: 'not found' } }, 404)]);
    await expect(driveDelete('tok', 'gone')).resolves.toBeUndefined();
    stubFetch([json({ error: { message: 'boom' } }, 500)]);
    await expect(driveDelete('tok', 'f')).rejects.toMatchObject({ code: 'E_SYNC_REMOTE' });
  });
});

describe('parseSyncContainer — 내려받은 본문의 관문', () => {
  const good: SyncContainer = { sync: 1, type: 'drill', id: 'dr_a', modifiedAt: 5, doc: { a: 1 } };

  it('정상 컨테이너는 통과, doc:null(톰스톤)도 유효하다', () => {
    expect(parseSyncContainer(good)).toEqual({ ok: true, container: good });
    expect(parseSyncContainer({ ...good, deletedAt: 9, doc: null }).ok).toBe(true);
  });

  it('sync 가 더 높으면 too-new — invalid 와 갈라 보고한다(앱 업데이트 안내 대상)', () => {
    expect(parseSyncContainer({ ...good, sync: 2 })).toEqual({ ok: false, reason: 'too-new' });
  });

  it('형식이 어긋나면 invalid — 손상 취급', () => {
    for (const bad of [null, 'x', {}, { ...good, type: 'mystery' }, { ...good, id: '' }, { ...good, modifiedAt: 'now' }]) {
      expect(parseSyncContainer(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
    const noDoc = { sync: 1, type: 'drill', id: 'dr_a', modifiedAt: 5 };
    expect(parseSyncContainer(noDoc)).toEqual({ ok: false, reason: 'invalid' });
  });
});
