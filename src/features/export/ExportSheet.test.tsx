// §6.4 내보내기 진입점 — 시트가 **정말로** 4.1/4.4/4.5 의 함수를 부르는가.
//
// 이 파일이 지키는 것 세 가지:
//   ① 닫힌 시트는 DOM 에 표적을 0개 남긴다(첫 화면 표적 예산 ≤40 의 전제).
//   ② 세 항목이 각각 **다른** 경로를 정확히 1회 부른다 — 스파이 호출 횟수 + "누르기 전에는
//      0회" 대조군을 항상 짝으로 둔다("0회라서 통과" 방지).
//   ③ 인쇄는 순서 계약을 지킨다 — window.print 가 불릴 **그 순간** 인쇄 페이지가 DOM 에
//      실재해야 한다(features/print/index.ts 머리말의 "조용한 사고").
//
// rasterize.ts 는 jsdom 에서 돌 수 없다(캔버스·Image 디코딩 없음 — 그 파일 머리말 ⚠️).
// 그래서 **그 모듈만** 모킹한다 — 그림 경로에서 검증할 수 있는 것은 "부르는가 · 무엇을 넘기는가
// · 결과 Blob 을 파일로 떨구는가" 이고, 픽셀은 실기 항목이다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Shape } from '../../model/shape.ts';

vi.mock('./rasterize.ts', () => ({
  rasterizeFrameToPng: vi.fn(async () => ({ blob: new Blob(['png'], { type: 'image/png' }), widthPx: 2048, heightPx: 1400 })),
}));
vi.mock('../../storage/files.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../storage/files.ts')>();
  return { ...actual, downloadBlob: vi.fn() };
});

import { ExportSheet } from './ExportSheet.tsx';
import { backupFileName, sceneFileName } from './exportNames.ts';
import { rasterizeFrameToPng } from './rasterize.ts';
import { downloadBlob } from '../../storage/files.ts';
import { createDrill } from '../../model/defaults.ts';
import { idbDrillRepo } from '../../storage/drillRepo.ts';
import { ToastProvider, useToast } from '../../store/toast/ToastProvider.tsx';
import { PRINT_PAGE_SELECTOR } from '../print/index.ts';

const rasterMock = vi.mocked(rasterizeFrameToPng);
const downloadMock = vi.mocked(downloadBlob);

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

const drill = createDrill({ courtMode: 'full', title: '자유 전술판', empty: true });

function renderSheet(open: boolean) {
  return render(<ExportSheet open={open} onClose={() => {}} drill={drill} stepIndex={0} showGrid={false} showRuleZones />, { wrapper });
}

/** 토스트는 프로바이더 **상태**에만 있다 — 호스트가 없으면 화면에 안 뜬다(BoardScreen.test 와
 *  같은 프로브 패턴). 버튼을 만들지 않으므로 항목 수 단언과 간섭하지 않는다. */
function ToastProbe() {
  const { toasts } = useToast();
  return (
    <ul>
      {toasts.map((t) => (
        <li key={t.id}>{t.message}</li>
      ))}
    </ul>
  );
}

/** ⚠️ open 을 **진짜 state 로** 든다. 상수 true 로 두면 항목이 onClose 를 불러도 시트가 닫히지
 *  않아, "닫힌 뒤에도 인쇄가 끝까지 간다"(PrintRoot 상주) 같은 계약이 통째로 검증되지 않는다 —
 *  실제로 그렇게 두었더니 PrintRoot 를 시트 안으로 되돌려도 이 파일이 전건 초록이었다. */
function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider>
      <ExportSheet
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        drill={drill}
        stepIndex={0}
        showGrid={false}
        showRuleZones
      />
      <ToastProbe />
    </ToastProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('닫힌 시트는 예산에 0을 더한다', () => {
  it('닫혀 있으면 세 항목도 인쇄 트리도 DOM 에 없다', () => {
    renderSheet(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelectorAll('button')).toHaveLength(0);
    expect(document.querySelectorAll(PRINT_PAGE_SELECTOR)).toHaveLength(0);
  });

  it('대조군: 열면 세 항목이 실제로 생긴다 — 위 it 이 "아무것도 못 찾는 선택자" 로 통과한 것이 아니다', () => {
    renderSheet(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    for (const name of [/^그림 \(PNG\)/, /^인쇄 · PDF/, /^기기 이사 파일 \(JSON\)/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    // 항목 3 + 닫기 1 = 4. 4항목 시트로 불어나면 여기가 먼저 운다(§6.4 "큰 표적 3개").
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});

describe('[그림] → 4.4 의 래스터 어댑터를 부른다', () => {
  it('누르기 전 0회 · 누른 뒤 정확히 1회, 그리고 그 Blob 이 downloadBlob 으로 간다', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    expect(rasterMock).toHaveBeenCalledTimes(0); // 대조군 — 렌더만으로는 안 부른다
    expect(downloadMock).toHaveBeenCalledTimes(0);

    await userEvent.click(screen.getByRole('button', { name: /^그림 \(PNG\)/ }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(1));
    expect(rasterMock).toHaveBeenCalledTimes(1);

    const [frame, opts] = rasterMock.mock.calls[0]!;
    // 장면은 지금 판에서 나온다 — 코트·팀·규칙존 스위치가 화면 값 그대로 실린다.
    expect(opts.mode).toBe('full');
    expect(opts.teams).toBe(drill.teams);
    expect(opts.showRuleZones).toBe(true);
    expect(opts.showGrid).toBe(false);
    // step.name 은 과제⑦ 이후 로드 경로에서 항상 '' 다 — 여기 픽스처도 마찬가지라
    // stepName 이 ''로 찍히는 것 자체는 의미 있는 대조가 아니다. note 에서 뽑아오는
    // 실제 계약은 바로 아래 별도 it 이 진다(검증 결함 수정, 2026-08-17).
    expect(opts.caption).toEqual({ title: '자유 전술판', stepIndex: 0, stepCount: 1, stepName: '' });
    expect(frame.stepIndex).toBe(0);

    const [blob, filename] = downloadMock.mock.calls[0]!;
    expect(blob.type).toBe('image/png');
    expect(filename).toBe(sceneFileName('자유 전술판', 0));
    expect(filename).toMatch(/\.png$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('그 스텝의 작도 도형이 옵션에 실린다 — 화면에는 있고 PNG 에만 없던 사고(2026-08-17 기현님 신고)', async () => {
    // 도형은 `RenderFrame` 에 없다(보간하지 않는 **표시**라 스텝이 갖는다). 그래서 프레임만
    // 넘기면 조용히 빠진다 — 여기가 그 한 줄을 세는 자리다.
    const shape: Shape = { id: 'sh_1', kind: 'rect', x: 120, y: 90, w: 80, h: 60, rot: 15 };
    const withShape = { ...drill, steps: [{ ...drill.steps[0]!, shapes: [shape] }] };
    render(
      <ToastProvider>
        <ExportSheet open onClose={() => {}} drill={withShape} stepIndex={0} showGrid={false} showRuleZones />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^그림 \(PNG\)/ }));
    await waitFor(() => expect(rasterMock).toHaveBeenCalledTimes(1));
    expect(rasterMock.mock.calls[0]![1].shapes).toEqual([shape]);
    // 대조군 — 도형이 없는 판은 빈 목록이다(위 단언이 "무엇이든 통과" 가 아니다).
    expect(drill.steps[0]!.shapes).toEqual([]);
  });

  it('캡션 stepName 은 note 첫 줄에서 온다 — name 필드는 항상 비므로 note 가 유일한 통로다(검증 결함 수정, 2026-08-17)', async () => {
    const withNote = { ...drill, steps: [{ ...drill.steps[0]!, note: '어깨너비 확인\n두 번째 줄' }] };
    render(
      <ToastProvider>
        <ExportSheet open onClose={() => {}} drill={withNote} stepIndex={0} showGrid={false} showRuleZones />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^그림 \(PNG\)/ }));
    await waitFor(() => expect(rasterMock).toHaveBeenCalledTimes(1));
    // 첫 줄만 — 둘째 줄(본문)은 PNG 에 그릴 자리가 없는 한 줄짜리 캡션이라 섞이면 안 된다.
    expect(rasterMock.mock.calls[0]![1]!.caption!.stepName).toBe('어깨너비 확인');
  });

  it('래스터가 실패하면 파일을 떨구지 않고 그 사유를 토스트로 말한다', async () => {
    rasterMock.mockRejectedValueOnce(new Error('이 브라우저에서는 그림으로 내보낼 수 없습니다.'));
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: /^그림 \(PNG\)/ }));
    await waitFor(() => expect(screen.getByText('이 브라우저에서는 그림으로 내보낼 수 없습니다.')).toBeTruthy());
    // 대조군의 반대편 — 실패 경로에서는 다운로드가 0회여야 한다(반쪽 파일이 떨어지면 안 된다).
    expect(downloadMock).toHaveBeenCalledTimes(0);
  });
});

describe('[인쇄] → 4.5 의 인쇄 트리를 세운 뒤에 print() 한다', () => {
  it('print 가 불린 그 순간 인쇄 페이지가 DOM 에 실재한다 (순서가 계약이다)', async () => {
    const pagesAtPrint: number[] = [];
    const printSpy = vi.fn(() => {
      pagesAtPrint.push(document.querySelectorAll(PRINT_PAGE_SELECTOR).length);
    });
    const original = window.print;
    window.print = printSpy;
    try {
      render(<Harness />);
      // 대조군 — 누르기 전에는 페이지도 0장이고 print 도 0회다.
      expect(document.querySelectorAll(PRINT_PAGE_SELECTOR)).toHaveLength(0);
      expect(printSpy).toHaveBeenCalledTimes(0);

      await userEvent.click(screen.getByRole('button', { name: /^인쇄 · PDF/ }));
      await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
      // ★ 이 단언이 4.5 머리말의 "조용한 사고"(빈 문서 인쇄)를 막는 자리다.
      expect(pagesAtPrint).toEqual([drill.steps.length]);
      // ★ 그리고 그 일은 **시트가 닫힌 뒤에** 일어난다 — PrintRoot 가 시트 안에 살면 여기서 죽는다.
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      window.print = original;
    }
  });

  it('인쇄가 끝나면 인쇄 트리를 걷는다 — 화면에 60장짜리 사본이 남아 있으면 안 된다', async () => {
    const original = window.print;
    window.print = vi.fn();
    try {
      render(<Harness />);
      await userEvent.click(screen.getByRole('button', { name: /^인쇄 · PDF/ }));
      await waitFor(() => expect(document.querySelectorAll(PRINT_PAGE_SELECTOR)).toHaveLength(0));
    } finally {
      window.print = original;
    }
  });
});

describe('[기기 이사 파일] → 4.1 의 backup 봉투를 부른다', () => {
  it('IDB 의 드릴이 실제로 담긴 backup 봉투가 파일로 떨어진다', async () => {
    await idbDrillRepo.createDrill({ courtMode: 'full', title: '백업에 담길 드릴' });
    render(<Harness />);
    expect(downloadMock).toHaveBeenCalledTimes(0); // 대조군

    await userEvent.click(screen.getByRole('button', { name: /^기기 이사 파일 \(JSON\)/ }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(1));

    const [blob, filename] = downloadMock.mock.calls[0]!;
    expect(filename).toMatch(/^SPIN_백업_\d{8}\.spin\.json$/);
    expect(filename).toBe(backupFileName(Date.now()));
    const parsed = JSON.parse(await blob.text()) as { spin: string; payload: { drills: Array<{ title: string }>; prefs: unknown } };
    // library 봉투(드릴만)로 되돌아가면 여기가 빨개진다 — 그게 §6.1b 가 '거짓말' 이라 부른 것이다.
    expect(parsed.spin).toBe('backup');
    expect(parsed.payload.drills.map((d) => d.title)).toContain('백업에 담길 드릴');
    expect(parsed.payload.prefs).toBeTruthy();
  });
});

describe('파일 이름 조립 (4.1 이 "4.7 이 조립한다" 고 남긴 자리)', () => {
  it('백업은 날짜가 붙은 .spin.json 이다', () => {
    expect(backupFileName(new Date(2026, 7, 12, 9, 30).getTime())).toBe('SPIN_백업_20260812.spin.json');
  });

  it('그림은 1-based 스텝 번호가 붙는다 — 캡션의 n/N 과 같은 숫자여야 짝이 지어진다', () => {
    expect(sceneFileName('측면 돌파', 0)).toBe('SPIN_측면 돌파_1.png');
    expect(sceneFileName('측면 돌파', 4)).toBe('SPIN_측면 돌파_5.png');
  });

  it('파일 이름에 쓸 수 없는 글자는 slugify 가 막는다', () => {
    expect(sceneFileName('a/b:c', 0)).toBe('SPIN_a-b-c_1.png');
  });
});
