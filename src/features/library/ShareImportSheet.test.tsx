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

/** 진짜 만들기 경로로 링크를 하나 만든다(목은 서버 왕복뿐이다). */
async function publish(drill: Drill): Promise<{ id: string; keyB64: string }> {
  const { createShareLink } = await import('../../share/index.ts');
  const made = await createShareLink(drill, 'https://spin.example');
  const [, keyB64] = made.link.split('#');
  return { id: made.id, keyB64: keyB64! };
}

beforeEach(async () => {
  store.clear();
  fetchSpy.mockClear();
  for (const d of await idbDrillRepo.listDrillSummaries()) await idbDrillRepo.deleteDrill(d.id);
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
    const { id, keyB64 } = await publish(src);
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
    const { id, keyB64 } = await publish(src);
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
    const { id, keyB64 } = await publish(src);
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
