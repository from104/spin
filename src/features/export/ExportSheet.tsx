// §6.4 내보내기 진입점 — **큰 표적으로만 묻는다.**
//
// 계획서 §6.4: *"[보드] 하단 바에 [내보내기] 1개 → 큰 항목 시트(인쇄 / 그림 / 파일).
// 헤더가 아니라 하단 바인 이유는 narrow 헤더를 52px 한 줄로 강제하기 때문이다(5.2)."*
// 그리고 같은 절의 *"큰 타깃이 작은 타깃 1개보다 싸다"* — 발 마우스·입 젓가락 사용자에게
// 케밥 2단계 정밀 조작은 기능 추가가 아니라 결함 추가다.
//
// ⚠️ 2026-08-20 (기현님 지시 — "드릴 편집에서 json 내보내기 삭제하고 설정 밑 부분에 데이터
// 내보내기로 넣기") — **세 항목이 두 항목(그림·인쇄)으로 줄었다.** 옛 [기기 이사 파일
// (JSON)] 항목은 설정 화면의 [데이터] 구역으로 옮겼다(SettingsScreen.tsx) — 그 파일이 담는
// 것(드릴·세션·설정·전술판 전체)이 "지금 이 판을 어떻게 꺼낼까" 라는 이 시트의 질문과
// 성격이 달라서다(이 시트는 **지금 보는 판** 하나를 그림·인쇄로 꺼내는 곳이지, 앱 전체를
// 백업하는 곳이 아니다). 2026-08-12(4.7)에 정반대 방향(설정→여기로 모으기)이었던 결정을
// 다시 뒤집은 것이다 — 그 경위는 SettingsScreen.tsx §데이터 섹션 주석에 남겨 뒀다.
//
// ── 왜 시트 안 항목은 예산(§3 ≤40)에 안 드는가 ────────────────────────────────────
// 시트는 **닫혀 있으면 DOM 에 없다**(Modal 이 `if (!open) return null`). boardTargetBudget 의
// "초기 상태" 정의가 그것이고, 그래서 이 파일이 화면에 더하는 표적은 **하단 바의 [내보내기]
// 1개뿐**이다. 그 1개의 자리는 [골대 원위치]를 확인 모달 안으로 옮겨 만들었다 — 근거는
// BoardBar.tsx 의 ⚠️ 주석에 있다. 여기에 배경(흰/투명)·해상도 같은 옵션 컨트롤을 **화면에
// 상주시키지 마라.** 옵션을 늘리려면 시트 안(=예산 밖)에서 늘려야 한다.
//
// ── 항목 순서 ─────────────────────────────────────────────────────────────────────
// 계획서가 항목을 "인쇄 / 그림" 순으로 나열하지만 **그림을 첫 칸에 둔다.** 같은 절이
// 판 걸이 카드에 대해 *"[공유] 1개(= PNG, 코치가 실제로 하는 행위)"* 라고 못박았기 때문이다 —
// 가장 자주 하는 일이 가장 가까운 칸(시트 상단 = 손가락이 올라오는 방향)에 온다.
//
// ── 포커스 계약 (§7.6) ────────────────────────────────────────────────────────────
// 이 시트는 `ui/Modal.tsx` 를 쓴다 = `role="dialog" aria-modal="true"` + Tab 트랩 + Esc 닫기
// + **트리거로 포커스 복귀**. InspectorHost 의 시트 계약(aria-modal="false", 트랩 없음)과
// 다른 것은 의도다: 인스펙터는 *판의 동반자*(고치면서 코트로 Tab 해 나가야 한다)지만 이 시트는
// **한 번 고르고 사라지는 갈림길**이다. 세 항목 중 하나를 고르는 동안 뒤의 판으로 새어 나갈
// 이유가 없고, 새어 나가면 시트가 열린 채 남는다.
//
// ── 인쇄의 순서가 계약이다 ────────────────────────────────────────────────────────
// `features/print/index.ts` 머리말: 상태에 doc 을 넣고 **곧바로** `window.print()` 를 부르면
// 아직 아무것도 없는 문서가 인쇄된다(예외도 경고도 없는 조용한 사고). 반드시 PrintRoot 의
// `onReady`(useLayoutEffect = 커밋 직후) 안에서 `printWhenReady()` 를 부른다.
// ⚠️ 그래서 `<PrintRoot>` 는 시트가 **닫혀 있어도 마운트된 채**여야 한다 — 인쇄를 고르는
//    순간 시트는 닫히기 때문이다. PrintRoot 는 doc 이 null 이면 null 을 렌더하므로(표적 0개)
//    상주시켜도 예산에 한 개도 안 든다.
import { useCallback, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Drill } from '../../model/drill.ts';
import { interpolateSteps } from '../../model/playback.ts';
import { LIMITS, noteFirstLine } from '../../model/validate.ts';
import { namedRosterOf } from '../../model/chairLabel.ts';
import { Modal } from '../../ui/Modal.tsx';
import { downloadBlob } from '../../storage/files.ts';
import { sceneFileName } from './exportNames.ts';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { PrintRoot, printWhenReady } from '../print/index.ts';
import type { PrintDoc } from '../print/index.ts';
import { rasterizeFrameToPng } from './rasterize.ts';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import { storageErrorText } from '../../i18n/storageError.ts';

export interface ExportSheetProps {
  open: boolean;
  onClose(): void;
  /** 지금 판(자유 전술판 또는 드릴 편집본). 그림·인쇄 둘 다 이 한 벌에서 굽는다. */
  drill: Drill;
  /** 그림으로 구울 스텝(0-based). 자유 전술판은 언제나 0 이다. */
  stepIndex: number;
  /** 화면의 격자·규칙존 스위치를 그대로 넘긴다 — "보이는 대로 나온다" 가 §6.2 표의 규칙이다. */
  showGrid: boolean;
  showRuleZones: boolean;
  /** 닫을 때 포커스를 되돌릴 트리거(하단 바의 [내보내기]) — §7.6. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ExportSheet({ open, onClose, drill, stepIndex, showGrid, showRuleZones, returnFocusRef }: ExportSheetProps) {
  const titleId = useId();
  const toast = useToast();
  const t = useT();
  const locale = useLocale();
  const [printDoc, setPrintDoc] = useState<PrintDoc | null>(null);
  // 같은 동작을 연타하면 파일이 두 벌 떨어진다(래스터는 수백 ms 걸린다). 화면에서 버튼을
  // 지우지는 않는다 — 표적이 사용 중에 사라지면 그게 더 나쁘다(§3 불변식 1 의 정신).
  const busyRef = useRef(false);

  const run = useCallback(
    async (fn: () => Promise<void>, fallback: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await fn();
      } catch (e) {
        toast.show(storageErrorText(e, locale, fallback));
      } finally {
        busyRef.current = false;
      }
    },
    [toast, locale],
  );

  const onPrintReady = useCallback(() => {
    // 0장이면 print() 를 부르지 않고 false 를 준다 — 그때 조용히 끝내면 코치는 인쇄 대화상자가
    // 안 뜬 이유를 영영 모른다.
    if (!printWhenReady()) toast.show(t('export.noPrintContent'));
    setPrintDoc(null);
  }, [toast, t]);

  // §7 3.4 선수 실명(§0.5 미배송 빚, 2026-08-20) — 안 적었으면 undefined(캡션 띠 두 줄
  // 그대로), 적었으면 시연 범례와 같은 값을 한 줄로 이어 붙이고 captionRosterLen 에서 자른다.
  const rosterCaptionText = (d: Drill): string | undefined => {
    const joined = namedRosterOf(d.cast.chairs).join(' · ');
    return joined.length > 0 ? joined.slice(0, LIMITS.captionRosterLen) : undefined;
  };

  const exportPng = () =>
    run(async () => {
      const step = drill.steps[stepIndex] ?? drill.steps[0];
      if (!step) throw new Error(t('export.noFrameToExport'));
      // 한 스텝을 그대로 굽는다 — from=to, e=1 이면 보간이 항등이다(트윈 중간을 굽지 않는다).
      const frame = { ...interpolateSteps(drill, step, step, 1), stepIndex };
      const { blob } = await rasterizeFrameToPng(frame, {
        mode: drill.courtMode,
        // §6.4 — 그림도 판과 **같은 코트**여야 한다. 이 한 줄이 없으면 28×15 로 그린 판이
        // 30×18 캔버스에 구워져, 카톡으로 보낸 그림만 코트가 다르다.
        size: drill.courtSize,
        teams: drill.teams,
        // 진영 — 골 지역 3인 반칙이 **수비 팀만** 세므로(2026-08-15) 이 한 줄이 없으면
        // 카톡으로 보낸 그림만 다른 팀을 붉게 칠한다(위 courtSize 와 같은 부류의 사고다).
        defense: drill.defense,
        // 작도 도형 — 프레임에는 없다(보간하지 않는 **표시**라 스텝이 갖는다). 이 한 줄이
        // 없으면 그림에만 도형이 통째로 빠진다(2026-08-17 기현님 신고).
        shapes: step.shapes,
        showGrid,
        showRuleZones,
        // step.name 은 과제⑦ 이후 로드된 드릴에서 항상 '' 다(validate.ts 정화기가 이름을
        // note 로 이관하며 비운다) — 그대로 두면 PNG 캡션은 번호만 찍는 죽은 기능이 된다.
        // PNG 는 note 본문을 어디에도 그리지 않아(코트 위 자유 메모(NOTE)와는 다른 필드다)
        // 이 캡션 서브라인이 스텝 텍스트가 이미지에 실리는 유일한 통로다 — note 첫 줄을
        // 이름표 후계로 삼아 caption 에 이어준다(검증 결함 수정, 2026-08-17).
        caption: {
          title: drill.title,
          stepIndex,
          stepCount: drill.steps.length,
          stepName: noteFirstLine(step.note).slice(0, LIMITS.stepNameLen),
          // §7 3.4 선수 실명(§0.5 미배송 빚, 2026-08-20) — 시연 범례와 같은 값. 캡션 띠는
          // 고정 폭이라 줄바꿈이 없어(staticSceneLayout) 여기서 미리 자른다.
          roster: rosterCaptionText(drill),
        },
      }, locale);
      downloadBlob(blob, sceneFileName(drill.title, stepIndex));
      onClose();
    }, t('export.pngFailed'));

  const startPrint = () => {
    // 시트를 먼저 닫는다: 인쇄 대화상자 뒤에 열린 시트가 남아 있으면 돌아왔을 때 판이 가려져
    // 있다. PrintRoot 는 시트 밖에 상주하므로(머리말 ⚠️) 닫아도 인쇄는 진행된다.
    onClose();
    setPrintDoc({ kind: 'drill', drill });
  };

  return (
    <>
      <Modal open={open} onClose={onClose} titleId={titleId} title={t('export.sheetTitle')} closeLabel={t('export.closeLabel')} returnFocusRef={returnFocusRef}>
        <p style={{ fontSize: '0.78125rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>{t('export.sheetDesc')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SheetItem title={t('export.png.title')} desc={t('export.png.desc')} onClick={() => void exportPng()} />
          <SheetItem title={t('export.print.title')} desc={t('export.print.desc')} onClick={startPrint} />
        </div>
      </Modal>
      <PrintRoot doc={printDoc} onReady={onPrintReady} />
    </>
  );
}

const ITEM_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  // 큰 표적 — §5.4 의 --hit(44/56) 두 줄분. 세 항목이 시트를 꽉 채우는 것이 이 설계의 요점이다.
  minHeight: 'calc(var(--hit) + 18px)',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border-strong)',
  background: 'transparent',
  color: 'var(--text)',
};

function SheetItem({ title, desc, onClick }: { title: string; desc: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={ITEM_STYLE}>
      <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700 }}>{title}</span>
      <span style={{ display: 'block', fontSize: '0.71875rem', color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}
