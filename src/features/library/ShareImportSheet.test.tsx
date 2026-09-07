// 공유 링크 **받기** 시트의 회귀 셋(PLAN-SHARE-LINK 결정 9·10).
//
// 목은 `src/share/api.ts` 의 서버 왕복뿐이다 — 올린 바이트를 메모리에 두고 그대로 돌려주므로
// 접기·잠그기·풀기·펴기·검증이 **전부 진짜로 돈다**. 그래서 이 파일은 "만든 링크로 정말 열리는가"
// 를 왕복으로 잰다(양쪽을 다 목으로 세우면 검사표가 자기 문자열을 자기가 확인하게 된다).
//
// 지우면 새는 것 셋:
//  ① 열쇠 없는 링크(메신저가 `#` 뒤를 잘라 먹은 것)에 대고 서버를 부르면, 어차피 못 여는
//     암호문을 받아 온 뒤에야 오류가 뜬다 — 남의 서버에 지우는 헛짐이고, 열쇠 복원을 먼저
//     한다는 openShareLink 의 순서 계약이 조용히 죽는다.
//  ② [저장]이 기존 가져오기 관문(parseSpinFile → prepareDrillImport → commitDrillImports)을
//     안 타면 마이그레이션·검증·id 충돌 처리가 두 벌이 된다. 같은 id 가 이미 있는데 덮어쓰면
//     남이 준 링크가 내 드릴을 말없이 지운다 — 이 앱에서 가장 비싼 종류의 사고다.
//  ③ 저장 경로가 `defaultResolution` 을 쓰면 conflict:'identical' 이 'skip' 이라, 같은 링크를
//     두 번 저장한 사람은 [저장]을 눌러도 아무 일도 안 일어나는 화면을 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ShareImportSheet } from './ShareImportSheet.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { createDrill } from '../../model/defaults.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import type { Drill } from '../../model/drill.ts';
import { CURRENT_SESSION_SCHEMA, flattenSessionItems } from '../../model/session.ts';
import type { TrainingSession } from '../../model/session.ts';
import { deleteSession, getSession, listSessions, putSession } from '../../storage/sessionRepo.ts';
import type { SharedDoc } from '../../share/index.ts';

/** 서버 대신 쓰는 메모리 한 칸. `createShareLink` 가 올린 바이트를 그대로 `fetchCiphertext` 가
 *  돌려준다 — 이 앱이 서버에 요구하는 계약(올린 것을 바이트 그대로)의 최소 모형이다. */
const store = new Map<string, Uint8Array>();
const fetchSpy = vi.fn();

vi.mock('../../share/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../share/api.ts')>();
  return {
    ...actual,
    uploadCiphertext: async (bytes: Uint8Array) => {
      const id = `Id${String(store.size).padStart(8, '0')}`;
      store.set(id, bytes);
      return { id, deleteToken: 'tok', expiresAt: 0 };
    },
    fetchCiphertext: async (id: string) => {
      fetchSpy(id);
      const found = store.get(id);
      if (!found) throw new actual.ShareError('not-found', { status: 404 });
      return found;
    },
  };
});

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

/** 진짜 만들기 경로로 링크를 하나 만든다(목은 서버 왕복뿐이다). 드릴이든 세션이든 같은 문이다
 *  (S5 — 링크 꼴은 하나이고 종류는 봉투가 말한다). */
async function publish(doc: SharedDoc): Promise<{ id: string; keyB64: string }> {
  const { createShareLink } = await import('../../share/index.ts');
  const made = await createShareLink(doc, 'https://spin.example');
  const [, keyB64] = made.link.split('#');
  return { id: made.id, keyB64: keyB64! };
}

const asDrill = (drill: Drill): SharedDoc => ({ kind: 'drill', drill });

/** 구획 2개에 드릴을 나눠 담은 세션. **구간 수와 드릴 수를 일부러 다르게** 둔다(2 vs 3) —
 *  같으면 미리보기가 둘을 맞바꿔 세도 초록이다. */
function sessionOf(drills: Drill[]): TrainingSession {
  const item = (d: Drill, i: number) => ({ id: `it_${i}` as never, drillId: d.id, titleCache: d.title, durationMinCache: d.durationMin, categoryCache: d.drillType });
  return {
    schemaVersion: CURRENT_SESSION_SCHEMA,
    id: 'se_shared_x' as TrainingSession['id'],
    title: '금요 훈련',
    location: '시립체육관',
    phases: [
      { id: 'ph_1' as TrainingSession['phases'][number]['id'], kind: 'warm-up', items: drills.slice(0, 1).map(item) },
      { id: 'ph_2' as TrainingSession['phases'][number]['id'], kind: 'technical', items: drills.slice(1).map((d, i) => item(d, i + 1)) },
    ],
    drillIds: drills.map((d) => d.id),
    createdAt: 0,
    updatedAt: 0,
  };
}

beforeEach(async () => {
  store.clear();
  fetchSpy.mockClear();
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
  for (const s of await listSessions()) await deleteSession(s.session.id);
});

describe('ShareImportSheet', () => {
  it('열쇠가 없으면 서버를 부르지 않고 "열쇠가 맞지 않음" 을 말한다', async () => {
    render(<ShareImportSheet id="Id00000000" keyB64={null} onClose={() => {}} onSaved={() => {}} />, { wrapper });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/열쇠가 맞지 않습니다/);
    // ① 잘린 링크에는 서버를 아예 안 부른다.
    // ⚠️ 이 한 줄은 시트의 조기 반환 **하나만** 지키는 게 아니다: 그것을 지워도
    //    `openShareLink` 가 열쇠 복원을 먼저 하므로 여전히 초록이다(돌연변이로 확인함).
    //    두 겹 중 **어느 하나라도** 뒤집히면(예: 시트가 먼저 받아 오고 나서 열려 하면) 여기가 운다.
    expect(fetchSpy).not.toHaveBeenCalled();
    // 열 수 없는 것에 [저장] 을 내밀지 않는다.
    expect(screen.queryByRole('button', { name: '내 목록에 저장' })).toBeNull();
  });

  it('없는 링크면 "없거나 만료" 문구다 — 서버는 없음과 만료를 가르지 않는다', async () => {
    render(<ShareImportSheet id="Id99999999" keyB64={'k'.repeat(43)} onClose={() => {}} onSaved={() => {}} />, { wrapper });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/없거나 만료됐습니다/);
  });

  it('미리보기 뒤 저장하면 drillRepo 에 문서가 생긴다', async () => {
    const src = createDrill({ courtMode: 'full', title: '받은 드릴' });
    const { id, keyB64 } = await publish(asDrill(src));
    const onSaved = vi.fn();
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={onSaved} />, { wrapper });

    expect(await screen.findByText('받은 드릴')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: '내 목록에 저장' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const saved = await idbDrillRepo.listDrillSummaries();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.id).toBe(src.id); // 충돌이 없으면 봉투의 id 를 그대로 물려받는다
  });

  it('같은 id 가 이미 있으면 원본을 덮지 않고 새 id 사본으로 들어간다', async () => {
    const src = createDrill({ courtMode: 'full', title: '원본' });
    const { id, keyB64 } = await publish(asDrill(src));
    // 링크로 온 것과 **같은 id** 를, 내용이 다른 채로 먼저 저장해 둔다.
    await idbDrillRepo.putDrill({ ...src, title: '내가 고친 것' });

    const onSaved = vi.fn();
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={onSaved} />, { wrapper });
    await screen.findByText('원본');
    await userEvent.setup().click(screen.getByRole('button', { name: '내 목록에 저장' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const saved = await idbDrillRepo.listDrillSummaries();
    expect(saved).toHaveLength(2); // ② 덮어쓰지 않았다
    const mine = saved.find((s) => s.id === src.id);
    expect(mine?.title).toBe('내가 고친 것'); // 내 것은 그대로다
    expect(saved.some((s) => s.id !== src.id)).toBe(true); // 사본은 새 id 다
  });

  it('내용이 똑같아도 [저장]은 실제로 저장한다 — 건너뛰기로 삼키지 않는다', async () => {
    const src = createDrill({ courtMode: 'full', title: '똑같은 것' });
    const { id, keyB64 } = await publish(asDrill(src));
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={() => {}} />, { wrapper });
    await screen.findByText('똑같은 것');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '내 목록에 저장' }));
    await waitFor(async () => expect(await idbDrillRepo.listDrillSummaries()).toHaveLength(1));

    // 두 번째 저장 — 이때 로컬본과 내용이 동일하다(conflict:'identical').
    await user.click(screen.getByRole('button', { name: '내 목록에 저장' }));
    // ③ 'skip' 으로 접히면 여기가 1 에 머문다.
    await waitFor(async () => expect(await idbDrillRepo.listDrillSummaries()).toHaveLength(2));
  });
});


// PLAN-SHARE-LINK §6 S1·S4(2026-09-08) — 세션 갈래.
//
// 지우면 새는 것 둘:
//  ④ 미리보기가 세션을 드릴로 착각하면(또는 숫자를 맞바꾸면) 받는 사람은 **무엇이 몇 개**
//     들어오는지 모른 채 [저장]을 누른다. 드릴 20개짜리 세션이 조용히 들어오는 자리다.
//  ⑤ 드릴을 먼저 심고 세션 참조를 그 결과(idMap)로 잇지 않으면, 같은 id 드릴을 이미 가진
//     사람의 세션은 **남의 드릴을 가리킨다**(사본이 아니라 내가 고쳐 둔 내 드릴을) — 편성이
//     조용히 딴 내용으로 채워지는, 이 기능에서 가장 비싼 사고다.
describe('ShareImportSheet — 세션 링크', () => {
  const drills = () => [
    createDrill({ courtMode: 'full', title: '슛 연습' }),
    createDrill({ courtMode: 'full', title: '패스 연습' }),
    createDrill({ courtMode: 'full', title: '수비 연습' }),
  ];

  it('④ 세션 미리보기는 제목·구간 수·드릴 수와 드릴 제목 목록을 보여준다', async () => {
    const ds = drills();
    const { id, keyB64 } = await publish({ kind: 'session', session: sessionOf(ds), drills: ds });
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={() => {}} onSavedSession={() => {}} />, { wrapper });

    expect(await screen.findByText('금요 훈련')).toBeInTheDocument();
    // 구간 2 · 드릴 3 — 숫자가 서로 달라야 맞바꿈이 잡힌다(sessionOf 주석).
    expect(screen.getByText('2구간 · 드릴 3개')).toBeInTheDocument();
    for (const d of ds) expect(screen.getByText(d.title)).toBeInTheDocument();
    // 세션인데 드릴 시트의 제목·문구가 뜨면 사람은 드릴 하나를 받는 줄 안다.
    expect(screen.getByRole('dialog', { name: '공유받은 세션' })).toBeInTheDocument();
  });

  it('⑤ [저장]은 드릴 N개 + 세션 1개를 심고, 같은 id 드릴이 있으면 세션 참조가 사본으로 이어진다', async () => {
    const ds = drills();
    const { id, keyB64 } = await publish({ kind: 'session', session: sessionOf(ds), drills: ds });
    // 링크가 데려오는 첫 드릴과 **같은 id** 를, 내용이 다른 채로 이미 갖고 있다.
    await idbDrillRepo.putDrill({ ...ds[0]!, title: '내가 고친 것' });

    const onSavedSession = vi.fn();
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={() => {}} onSavedSession={onSavedSession} />, { wrapper });
    await screen.findByText('금요 훈련');
    await userEvent.setup().click(screen.getByRole('button', { name: '내 목록에 저장' }));
    await waitFor(() => expect(onSavedSession).toHaveBeenCalledTimes(1));

    // 보고 = "드릴 3개 + 세션 1개". 봉투에 든 수가 아니라 **실제로 심은 수**다.
    expect(onSavedSession.mock.calls[0]![0]).toMatchObject({ drills: 3 });
    const savedSessions = await listSessions();
    expect(savedSessions).toHaveLength(1);
    const saved = savedSessions[0]!.session;
    expect(saved.title).toBe('금요 훈련');
    expect(saved.location).toBe('시립체육관'); // S2 — 장소·메모는 남는다(그래서 모달이 고지한다)

    // 내 드릴은 안 덮였다.
    const { repo } = await import('../../storage/drillRepo.ts').then((m) => m.resolveDrillRepo());
    expect((await repo.getDrill(ds[0]!.id))?.title).toBe('내가 고친 것');
    // 세션의 첫 항목은 내 드릴이 아니라 **사본**을 가리킨다.
    const items = flattenSessionItems(saved);
    expect(items).toHaveLength(3);
    expect(items[0]!.drillId).not.toBe(ds[0]!.id);
    expect((await repo.getDrill(items[0]!.drillId))?.title).toMatch(/^슛 연습 \(사본/);
    // 충돌이 없던 나머지 둘은 봉투의 id 를 그대로 물려받고, 그 참조도 그대로다.
    expect(items.slice(1).map((it) => it.drillId)).toEqual([ds[1]!.id, ds[2]!.id]);
  });

  it('⑥ 같은 세션 링크를 두 번 저장하면 첫 저장 뒤 내가 손본 세션을 덮지 않고 두 번째 세션이 생긴다', async () => {
    // 2026-09-08 검수. 지우면 새는 것: 보낸 쪽이 고쳐서 다시 보낸 링크(같은 세션 id)를 저장하는
    // 순간, 받은 뒤 내가 넣은 참가자·메모가 말없이 사라진다 — 드릴 갈래가 allCopy 로 막은 것과
    // 같은 종류의 사고다(남이 준 링크가 내 것을 지운다).
    const ds = drills();
    const { id, keyB64 } = await publish({ kind: 'session', session: sessionOf(ds), drills: ds });
    const user = userEvent.setup();

    const first = vi.fn();
    const v1 = render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={() => {}} onSavedSession={first} />, { wrapper });
    await screen.findByText('금요 훈련');
    await user.click(screen.getByRole('button', { name: '내 목록에 저장' }));
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    v1.unmount();
    // 처음 받는 세션은 보낸 쪽 id 그대로다(파일 가져오기와 같은 결과) — 그 위에 내가 손본다.
    const mine = (await getSession('se_shared_x' as TrainingSession['id']))!.session;
    await putSession({ ...mine, note: '내가 적은 메모' });

    const second = vi.fn();
    render(<ShareImportSheet id={id} keyB64={keyB64} onClose={() => {}} onSaved={() => {}} onSavedSession={second} />, { wrapper });
    await screen.findByText('금요 훈련');
    await user.click(screen.getByRole('button', { name: '내 목록에 저장' }));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));

    const all = await listSessions();
    expect(all).toHaveLength(2);
    expect((await getSession('se_shared_x' as TrainingSession['id']))!.session.note).toBe('내가 적은 메모');
    const copy = all.find((s) => s.session.id !== 'se_shared_x')!.session;
    expect(copy.note).toBeUndefined();
    // 두 번째 세션의 편성도 이번에 심긴 드릴(사본)을 가리켜 하나도 '삭제됨' 이 아니다.
    const { repo } = await import('../../storage/drillRepo.ts').then((m) => m.resolveDrillRepo());
    for (const it of flattenSessionItems(copy)) expect(await repo.getDrill(it.drillId)).toBeDefined();
  });
});
