// §4.6/§6.8/§7.4 설정 화면. 각 컨트롤이 실제 SettingsProvider/localStorage 에 반영되는지,
// 물리 슬라이더·기본값 복원과 기기 이사 파일 읽기(§6.1b) 흐름을 확인한다.
// downloadBlob 은 <a> 클릭을 트리거한다 — jsdom 에서 no-op 이지만 URL.createObjectURL 은
// jsdom 미구현이라 모킹한다(features/library/transfer.test.ts 와 동일 패턴).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

vi.mock('../../storage/files.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/files.ts')>();
  return { ...actual, downloadBlob: vi.fn() };
});

import { SettingsScreen } from './SettingsScreen.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { ToastHost } from '../../ui/ToastHost.tsx';
import { loadPrefs, makeDefaultPrefs, resolvePhysics, savePrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { loadBoard, saveBoard } from '../../storage/board.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { collectBackup, exportBackupFile } from '../../storage/transfer.ts';
import { downloadBlob } from '../../storage/files.ts';
import { createDrill } from '../../model/defaults.ts';

const downloadMock = vi.mocked(downloadBlob);

function ToastHostBridge() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>
        {children}
        <ToastHostBridge />
      </ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(() => {
  localStorage.clear();
});

describe('SettingsScreen — 언어(i18n C1)', () => {
  it("맨 위 섹션이다 — 기본값 '자동'이 선택돼 있다", () => {
    render(<SettingsScreen />, { wrapper });
    const group = screen.getByRole('radiogroup', { name: '언어' });
    expect(within(group).getByRole('radio', { name: '자동' })).toHaveAttribute('aria-checked', 'true');
  });

  it('한국어를 고르면 즉시 반영되고 localStorage 에 저장된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '한국어' }));
    expect(screen.getByRole('radio', { name: '한국어' })).toHaveAttribute('aria-checked', 'true');
    expect(loadPrefs().language).toBe('ko');
  });

  it('English 를 고르면 이 섹션의 문구가 곧바로 영어로 바뀐다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: 'English' }));
    expect(loadPrefs().language).toBe('en');
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });

  it('日本語를 고르면 prefs 에 ja 로 저장된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '日本語' }));
    expect(loadPrefs().language).toBe('ja');
  });
});

describe('SettingsScreen — 화면', () => {
  it('기본값을 반영해 렌더한다', () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: '격자 표시' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '100%' })).toHaveAttribute('aria-checked', 'true');
  });

  it('테마를 라이트로 바꾸면 즉시 반영되고 localStorage 에 저장된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '라이트' }));
    expect(screen.getByRole('radio', { name: '라이트' })).toHaveAttribute('aria-checked', 'true');
    expect(loadPrefs().theme).toBe('light');
  });

  it('격자 표시 토글이 prefs.showGrid 를 뒤집는다', async () => {
    render(<SettingsScreen />, { wrapper });
    const toggle = screen.getByRole('switch', { name: '격자 표시' });
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().showGrid).toBe(false);
  });

  it('UI 배율을 130% 로 바꾸면 prefs.a11y.uiScale 이 갱신된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('radio', { name: '130%' }));
    expect(loadPrefs().a11y.uiScale).toBe(1.3);
  });

  // §4.3 P1-4 — 이 화면은 값만 쓴다. 실제로 소리를 끄는 배선은 app-shell 이 진다
  // (src/app/themeEffects.cues.test.tsx). 여기서는 "끌 수 있는가" 만 본다.
  it('놓임 소리·진동 토글이 prefs.a11y.sound 를 뒤집는다 — 기본은 켬이다', async () => {
    render(<SettingsScreen />, { wrapper });
    const toggle = screen.getByRole('switch', { name: '놓임 소리·진동' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().a11y.sound).toBe(false);
  });

  // 감사 2026-08-08 major #1 회귀 — 이 토글은 SettingsScreen 에서 prefs 로 저장되기만 하고
  // 어떤 렌더러도 읽지 않았다. 소비처(GridOverlay/CourtStage) 배선은 render 쪽 테스트가 맡고,
  // 여기서는 "설정 화면이 이 값을 여전히 정상적으로 쓰고 읽는다"만 확인한다.
  it('격자 칸 라벨 표시 토글이 prefs.showGridLabels 를 뒤집는다', async () => {
    render(<SettingsScreen />, { wrapper });
    const toggle = screen.getByRole('switch', { name: '격자 칸 라벨 표시' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(loadPrefs().showGridLabels).toBe(false);
  });

  // [기본 코트 모드] 행과 그 쓰기 테스트는 2026-08-21 폐기 — settingsDescTruth.test.tsx 의
  // 'C2 종결' 블록이 행·키·소비처의 부재를 못박는다.
});

describe('SettingsScreen — 시연 (minor #5, 이전에는 설정 화면에 노출되지 않았다)', () => {
  it('화면 꺼짐 방지·자동 전체화면 토글이 각각 prefs.present 에 반영된다', async () => {
    render(<SettingsScreen />, { wrapper });
    const wakeLock = screen.getByRole('switch', { name: '화면 꺼짐 방지' });
    const autoFs = screen.getByRole('switch', { name: '자동 전체화면' });
    expect(wakeLock).toHaveAttribute('aria-checked', 'true'); // 기본값 true
    expect(autoFs).toHaveAttribute('aria-checked', 'false'); // 기본값 false

    const user = userEvent.setup();
    await user.click(wakeLock);
    expect(loadPrefs().present.wakeLock).toBe(false);
    await user.click(autoFs);
    expect(loadPrefs().present.autoFullscreen).toBe(true);
  });
});

// 'SettingsScreen — 팀 색상' describe(§7.8 상호 배제 2건)는 2026-08-21 은퇴 — [팀] 섹션
// 자체가 폐기됐다(settingsDescTruth.test.tsx 의 'C3 종결' 이 행·키·소비처의 부재를 못박는다).

// 6.1(2026-08-13) — 물리 6종은 **닫힌 서랍**이 됐다. 아래 세 테스트(존 경계 · 기본값 복원 ·
// 편집 속도 배수 설명)는 원래 펼쳐진 화면을 전제로 했는데, 단언을 지우지 않고 '서랍을 연다'
// 단계를 앞에 붙여 승격시켰다(선례: 4.6 이 4.4 의 자리표시 단언을 반대 단언으로 승격).
describe('SettingsScreen — 물리 (6.1: 닫힌 서랍)', () => {
  /** [세부 조정] 서랍을 연다. 이름은 상태와 무관하게 고정이고 개폐는 aria-expanded 가 말한다. */
  async function openPhysicsDrawer() {
    await userEvent.setup().click(screen.getByRole('button', { name: '세부 조정' }));
  }

  it('서랍은 닫힌 채로 태어난다 — 슬라이더가 DOM 에 없고, 열면 6종이 나온다', async () => {
    render(<SettingsScreen />, { wrapper });
    const disclosure = screen.getByRole('button', { name: '세부 조정' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    // 대조군 — 빈 화면이라 슬라이더가 없는 것이 아니다: 접근성 설정은 그대로 보인다.
    expect(screen.getByRole('switch', { name: '큰 터치 타깃' })).toBeInTheDocument();

    await openPhysicsDrawer();
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('slider')).toHaveLength(6); // 존 3 + 속도 2 + 배수 1
  });

  it('⚠️ 서랍이 닫혀 있어도 저장값은 살아 있다 — 안 보인다고 기본값으로 돌아가면 재앙이다', async () => {
    // 다른 기기(또는 지난 세션)에서 조정해 둔 오버라이드가 이미 저장돼 있다.
    const d = makeDefaultPrefs();
    savePrefs({ ...d, physics: { zones: { sTowRearMax: 0.18 }, linearKmh: 6 } });

    render(<SettingsScreen />, { wrapper });
    expect(screen.queryAllByRole('slider')).toHaveLength(0); // 서랍은 닫혀 있다

    // 닫힌 채로 **다른 설정을 저장**해 본다 — setPrefs 병합이 physics 를 흘리면 여기서 죽는다.
    await userEvent.setup().click(screen.getByRole('switch', { name: '격자 표시' }));
    expect(loadPrefs().showGrid).toBe(false);
    expect(loadPrefs().physics).toEqual({ zones: { sTowRearMax: 0.18 }, linearKmh: 6 });
    // 판정 경로(resolvePhysics)에도 여전히 닿는다 — 화면에 안 보이는 것과 적용은 별개다.
    const resolved = resolvePhysics(loadPrefs());
    expect(resolved.zones.sTowRearMax).toBe(0.18);
    expect(resolved.linearKmh).toBe(6);

    // 열면 저장값 그대로 그려진다 — 기본값으로 그려지면 다음 슬라이더 조작이 저장값을 덮는다.
    await userEvent.setup().click(screen.getByRole('button', { name: '세부 조정' }));
    expect(screen.getByRole('slider', { name: '후방 견인 경계' })).toHaveValue('0.18');
    expect(screen.getByRole('slider', { name: '전후진 속도 상한' })).toHaveValue('6');
  });

  it('존 경계 슬라이더를 조정하면(서랍을 열면 나온다) 즉시 표시가 바뀌고 저장된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await openPhysicsDrawer();
    const slider = screen.getByRole('slider', { name: '후방 견인 경계' });
    // 리터럴로 두면 기본값을 조정할 때마다 슬라이더 동작과 무관하게 빨간불이 뜬다.
    expect(slider).toHaveValue(String(DEFAULT_ZONES.sTowRearMax));
    // userEvent 는 range 타이핑을 지원하지 않으므로 fireEvent.change 로 직접 갱신한다.
    fireEvent.change(slider, { target: { value: '0.18' } });
    expect(loadPrefs().physics.zones?.sTowRearMax).toBe(0.18);
  });

  it('기본값으로 복원하면(서랍을 열면 나온다) physics 오버라이드가 비워진다', async () => {
    render(<SettingsScreen />, { wrapper });
    await openPhysicsDrawer();
    const slider = screen.getByRole('slider', { name: '후방 견인 경계' });
    fireEvent.change(slider, { target: { value: '0.18' } });
    expect(loadPrefs().physics.zones?.sTowRearMax).toBe(0.18);

    await userEvent.setup().click(screen.getByRole('button', { name: '기본값으로 복원' }));
    await waitFor(() => expect(screen.getByRole('slider', { name: '후방 견인 경계' })).toHaveValue(String(DEFAULT_ZONES.sTowRearMax)));
    expect(loadPrefs().physics).toEqual({});
  });

  // §설정 화면 감사(2026-08-21) B-2 — speedLimit 은 이 서랍의 슬라이더 6종과 다른 층이다
  // (편집 화면 FunctionBar 의 속도 제한 해제 토글). 이 서랍이 안 보여주는 값까지 되돌리면
  // 편집 중 속도 제한을 꺼둔 코치가 여기서 슬라이더만 되돌려도 제한이 말없이 다시 켜진다.
  it('기본값으로 복원해도 speedLimit(편집 화면의 속도 제한 해제)은 건드리지 않는다', async () => {
    savePrefs({ ...makeDefaultPrefs(), physics: { zones: { sTowRearMax: 0.18 }, speedLimit: false } });
    render(<SettingsScreen />, { wrapper });
    await openPhysicsDrawer();

    await userEvent.setup().click(screen.getByRole('button', { name: '기본값으로 복원' }));
    await waitFor(() => expect(screen.getByRole('slider', { name: '후방 견인 경계' })).toHaveValue(String(DEFAULT_ZONES.sTowRearMax)));
    expect(loadPrefs().physics).toEqual({ speedLimit: false });
  });
});

describe('SettingsScreen — 물리 설명문 (minor 회귀)', () => {
  // 감사 2026-08-08 minor — "놓은 뒤 자동 재생에만 적용"이라는 옛 설명은 실제 동작(드래그 중
  // 속도 상한에도 곱해진다, EditorProvider.tsx vLinPxPerS/omegaRadPerS)과 달랐다. 동작이
  // 계약(prefs.ts §5.11 주석)에 맞으므로 설명문 쪽을 고쳤다 — "자동 재생에만" 문구가 다시
  // 나타나지 않는지 확인한다. 6.1 이후 이 문장은 서랍을 열어야 나온다.
  it('"편집 속도 배수" 설명이 드래그에도 적용됨을 밝힌다("자동 재생에만"이라고 말하지 않는다)', async () => {
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('button', { name: '세부 조정' }));
    expect(screen.getByText('드래그와 놓은 뒤 이어가기, 둘 다의 속도 상한에 곱해집니다')).toBeInTheDocument();
    expect(screen.queryByText(/자동 재생에만 적용/)).toBeNull();
  });
});

// 옛 기록(2026-08-12, 4.7) — 여기 있던 '데이터 내보내기' 는 한 번 버튼째 사라졌었다. [드릴
// 내보내기]가 목록 화면에도 같은 것이 있던 중복이었고, 담기는 것이 드릴뿐이라 세션·설정·
// 전술판이 어떤 파일에도 안 들어가는 거짓 백업이었기 때문이다. 쓰는 곳을 [보드] 하단
// [내보내기] 하나로 모으고 이 화면에는 읽는 쪽만 남겼다.
//
// ⚠️ 2026-08-20 (기현님 지시) — **내보내기가 돌아온다.** 이번엔 4.7 이 걱정하던 거짓 백업이
// 아니다 — 드릴 편집 [내보내기]가 만들던 것과 같은 backup 봉투(드릴·세션·설정·전술판 전부)
// 를 그대로 쓴다. 옛 아래 두 테스트("내보내기 버튼이 없다"·"만드는 곳을 말해 준다")는
// 정확히 반대 사실을 이제 확인해야 하므로 다시 쓴다.
describe('SettingsScreen — 데이터 내보내기(2026-08-20)', () => {
  it('내보내기 버튼이 있고, 누르면 backup 봉투가 파일로 떨어진다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '측면 돌파', drillType: 'tactical' });
    render(<SettingsScreen />, { wrapper });
    expect(downloadMock).toHaveBeenCalledTimes(0); // 대조군

    await userEvent.setup().click(screen.getByRole('button', { name: '내보내기' }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(1));

    const [blob, filename] = downloadMock.mock.calls[0]!;
    expect(filename).toMatch(/^SPIN_backup_\d{8}\.spin\.backup\.json$/);
    const parsed = JSON.parse(await blob.text()) as { spin: string; payload: { drills: Array<{ title: string }>; prefs: unknown } };
    // library 봉투(드릴만)로 되돌아가면 여기가 빨개진다 — 그게 §6.1b 가 '거짓말' 이라 부른 것이다.
    expect(parsed.spin).toBe('backup');
    expect(parsed.payload.drills.map((d) => d.title)).toContain('측면 돌파');
    expect(parsed.payload.prefs).toBeTruthy();
    expect(await screen.findByText(/드릴 \d+개 · 세션 \d+개와 설정을 파일 하나에 담았습니다\./)).toBeInTheDocument();
  });
});

describe('SettingsScreen — 데이터 가져오기 (§6.1b, 옛 이름 "기기 이사 파일 읽기")', () => {
  /** backup 봉투 한 벌을 파일로 만든다. 지금 저장소 상태를 그대로 싣는다. */
  async function backupFile(name = 'SPIN_백업_20260812.spin.json'): Promise<File> {
    const text = await exportBackupFile(await collectBackup()).text();
    return new File([text], name, { type: 'application/json' });
  }

  async function pick(file: File) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input, '파일 입력이 없다').not.toBeNull();
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('파일을 고르면 곧바로 복원하지 않고 먼저 묻는다 — 설정 체크박스는 꺼진 채로 나온다', async () => {
    render(<SettingsScreen />, { wrapper });
    expect(screen.queryByRole('dialog')).toBeNull(); // 대조군: 처음엔 없다
    await pick(await backupFile());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('SPIN_백업_20260812.spin.json')).toBeInTheDocument();
    const check = within(dialog).getByRole('checkbox', { name: /설정도 함께 복원/ });
    // ⚠️ 기본 꺼짐 — 남의 백업으로 드릴만 받을 때 접근성 설정이 말없이 바뀌면 사고다.
    expect(check).not.toBeChecked();
    expect(within(dialog).getByText(/큰 터치 타깃 같은 설정이 그대로 유지됩니다/)).toBeInTheDocument();
  });

  it('[읽기]를 누르면 드릴이 들어오고 세 숫자를 보고한다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '백업용 드릴' });
    const file = await backupFile();
    render(<SettingsScreen />, { wrapper });
    await pick(file);
    await userEvent.setup().click(await screen.findByRole('button', { name: '읽기' }));
    expect(await screen.findByText(/드릴 \d+개 가져옴 · \d+개 실패 · \d+개 건너뜀/)).toBeInTheDocument();
    // 체크박스를 안 켰으므로 설정은 그대로다 — 보고 줄이 그 사실을 말한다.
    expect(screen.getByText(/설정은 그대로 둠/)).toBeInTheDocument();
  });

  it('설정도 함께 복원을 켜면 화면의 설정 컨트롤이 **그 자리에서** 새 값으로 바뀐다', async () => {
    // ⚠️ 이게 없으면 복원 직후 화면은 옛 값을 보여주고, 그 상태에서 스위치 하나만 건드려도
    //    방금 복원한 설정이 통째로 되돌아간다(setPrefs 가 화면의 옛 prefs 위에 패치를 얹는다).
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), theme: 'light' }));
    const file = await backupFile(); // 이 파일의 테마는 라이트
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), theme: 'dark' }));

    render(<SettingsScreen />, { wrapper });
    // 대조군 — 시작은 다크다(파일과 다른 값에서 출발해야 변화가 의미를 갖는다).
    expect(screen.getByRole('radio', { name: '다크' })).toHaveAttribute('aria-checked', 'true');

    await pick(file);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: /설정도 함께 복원/ }));
    await user.click(screen.getByRole('button', { name: '읽기' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: '라이트' })).toHaveAttribute('aria-checked', 'true'));
    expect(loadPrefs().theme).toBe('light');
  });

  // ── 5.0 ②b(2026-08-13) — 편집 중인 자유 전술판을 백업에서 되살리는 길 ──────────────────────
  // 전에는 runRestore 가 board 옵션을 아예 안 넘겨 항상 'auto' 였고, board:'replace' 를 여는
  // UI 가 저장소 어디에도 없었다 — 편집 중인 판은 백업에서 **영영** 못 되살렸다. 회피책([코트
  // 비우기] 후 재시도)은 아무도 알 수 없었다. 이 체크박스는 [보드] 초기 화면이 아니라 설정
  // 화면의 닫힌 모달 안이므로 §3 표적 예산(≤40) 밖이다(boardTargetBudget.test.tsx 규칙 1).

  it('전술판 교체 체크박스가 꺼진 채로 나온다 — 파괴적 동작의 기본값은 끔이다', async () => {
    render(<SettingsScreen />, { wrapper });
    await pick(await backupFile());
    const dialog = await screen.findByRole('dialog');
    const check = within(dialog).getByRole('checkbox', { name: /전술판 교체/ });
    expect(check).not.toBeChecked();
    // 대조군 — 설정 체크박스와 별개의 컨트롤이다(하나를 켜도 다른 하나가 안 켜진다).
    expect(within(dialog).getByRole('checkbox', { name: /설정도 함께 복원/ })).not.toBeChecked();
  });

  it('끈 채 읽으면 편집 중인 판은 남고, 토스트가 **이유와 다음 행동**을 말한다', async () => {
    saveBoard(createDrill({ courtMode: 'full', title: '백업 속 판' }), false);
    const file = await backupFile(); // 이 파일에는 판이 들어 있다
    saveBoard(createDrill({ courtMode: 'full', title: '이 기기의 편집 중 판' }), false);

    render(<SettingsScreen />, { wrapper });
    await pick(file);
    await userEvent.setup().click(await screen.findByRole('button', { name: '읽기' }));

    // 옛 토스트는 '전술판은 그대로 둠' 이라고만 해 이유를 안 말했다(5.0 ②a 가 사유를 갈랐다).
    expect(await screen.findByText(/편집 중이라 그대로 둠/)).toBeInTheDocument();
    expect(screen.getByText(/\[전술판 교체\]를 켜고 다시 읽으세요/)).toBeInTheDocument();
    expect(loadBoard()?.drill.title).toBe('이 기기의 편집 중 판'); // 판은 실제로 안 덮였다
  });

  it('켜고 읽으면 편집 중인 판이 파일 속 판으로 바뀐다 — 체크박스가 실제로 replace 를 배선한다', async () => {
    saveBoard(createDrill({ courtMode: 'full', title: '백업 속 판' }), false);
    const file = await backupFile();
    saveBoard(createDrill({ courtMode: 'full', title: '희생될 편집 중 판' }), false);

    render(<SettingsScreen />, { wrapper });
    await pick(file);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: /전술판 교체/ }));
    await user.click(screen.getByRole('button', { name: '읽기' }));

    await waitFor(() => expect(loadBoard()?.drill.title).toBe('백업 속 판'));
    expect(await screen.findByText(/전술판 복원함/)).toBeInTheDocument();
  });

  it('백업이 아닌 파일은 사유를 말한다 — 조용히 아무 일도 안 일어나면 안 된다', async () => {
    render(<SettingsScreen />, { wrapper });
    await pick(new File(['그냥 글자'], 'x.json', { type: 'application/json' }));
    await userEvent.setup().click(await screen.findByRole('button', { name: '읽기' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull(); // 실패해도 물음은 닫힌다
  });
});

describe('SettingsScreen — 도움말·튜토리얼 (§0.5 Phase 6)', () => {
  it('[모두 다시 보기] 를 누르면 tutorialsSeen 이 통째로 비고 토스트가 뜬다', async () => {
    savePrefs({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true, board: true, present: true } });
    render(<SettingsScreen />, { wrapper });
    await userEvent.setup().click(screen.getByRole('button', { name: '모두 다시 보기' }));

    expect(loadPrefs().tutorialsSeen).toEqual({});
    expect(await screen.findByText(/튜토리얼을 다시 봅니다/)).toBeInTheDocument();
  });
});
