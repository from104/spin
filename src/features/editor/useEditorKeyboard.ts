// §7.5f 전역 단축키 + §7.5c 개체 포커스 키 + §7.5d 키보드 배치 커서.
// WCAG 2.1.4 준수: 문자/숫자 단일 키는 `a11y.singleKeyShortcuts`(on/modifier/off) 를 따르고,
// 파괴적 동작(E, Delete)은 그 설정과 무관하게 항상 수식키(Alt)를 요구한다(§7.5f 본문).
import { useEffect, useRef } from 'react';
import { isEditableTarget, isInteractiveTarget } from '../../ui/keyboard.ts';
import type { ToolId } from '../../physics/index.ts';
import { toolForKey } from './toolDefs.ts';

export type SingleKeyMode = 'on' | 'modifier' | 'off';

export interface EditorKeyboardDeps {
  tool: ToolId;
  singleKeyMode: SingleKeyMode;
  selectionSize: number;
  onSelectTool(t: ToolId): void;
  onConeToggle(): void;
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onDuplicateStep(): void;
  onPrevStep(): void;
  onNextStep(): void;
  onTogglePlay(): void;
  onToggleGrid(): void;
  onToggleRuleZones(): void;
  onZoomIn(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onEraseSelection(scope: 'onward' | 'thisStep'): void;
  onShowHelp(): void;
  /** §4.3 P1-2 [A-3] Esc = 선택 해제. 2단 히트가 켜지면 붐비는 코트에서 "빈 곳 탭 → 해제"
   *  가 사라지므로, 포인터와 무관한 이 전역 경로가 해제를 보장한다. */
  onSelectionClear(): void;
}

/** 전역(document) 키다운 — 개체가 아니라 화면 전체를 대상으로 하는 단축키. */
export function useEditorKeyboard(deps: EditorKeyboardDeps): void {
  const ref = useRef(deps);
  ref.current = deps;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const d = ref.current;
      const editable = isEditableTarget(e.target);
      const mod = e.ctrlKey || e.metaKey;
      const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (mod) {
        if (lower === 's') {
          e.preventDefault();
          d.onSave();
          return;
        }
        if (editable) return; // 나머지 조합은 텍스트 입력 중엔 네이티브 동작에 맡긴다
        if (lower === 'z' && !e.shiftKey) {
          e.preventDefault();
          d.onUndo();
          return;
        }
        if ((lower === 'z' && e.shiftKey) || lower === 'y') {
          e.preventDefault();
          d.onRedo();
          return;
        }
        if (lower === 'd') {
          e.preventDefault();
          d.onDuplicateStep();
          return;
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          d.onZoomIn();
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          d.onZoomOut();
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          d.onZoomReset();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          d.onEraseSelection(e.altKey ? 'thisStep' : 'onward');
          return;
        }
        return;
      }

      if (editable) return;

      // §4.3 P1-2 [A-3] — Esc = 선택 해제(전역). Esc 소비자들과의 우선순위:
      //   1) 모달(ui/Modal.tsx — 도움말·전술판 초기화 확인)이 열려 있으면 모달이 이긴다 —
      //      Modal 이 document **캡처** 단계에서 stopPropagation 하므로 여기(버블)에는
      //      도달조차 않는다. 이 순서는 코드가 아니라 등록 단계가 보장한다.
      //   2) 텍스트 입력 중에는 발화하지 않는다 — 바로 위 editable 반환. IME 조합 취소·
      //      필드 자체의 Esc 의미를 빼앗으면 안 된다.
      //   3) CourtStage 의 팬 무장 해제(window 리스너)와는 **동시에** 발화한다 — 둘 다
      //      "일시 상태를 물린다" 라 충돌이 아니며, 그래서 여기서 stopPropagation 을 걸지
      //      않는다(걸면 무장이 영영 안 풀린다).
      //   4) 스테이지에 포커스가 있으면 EditorStage 컨테이너 핸들러도 같은 SELECT_CLEAR 를
      //      디스패치한다 — 리듀서의 size===0 no-op 가드가 중복을 흡수한다.
      // singleKeyMode 게이트보다 앞이다: Esc 는 문자키가 아니라 취소 키라 WCAG 2.1.4 의
      // 단일 문자키 제한 대상이 아니다(Delete 와 같은 층).
      if (e.key === 'Escape') {
        d.onSelectionClear();
        return;
      }

      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        d.onShowHelp();
        return;
      }

      if (e.key === ' ') {
        if (isInteractiveTarget(e.target)) return; // §7.5f 네이티브 버튼 활성화와 이중발화 방지
        e.preventDefault();
        d.onTogglePlay();
        return;
      }

      if (!e.altKey) {
        if (e.key === 'ArrowLeft' && d.selectionSize === 0) {
          e.preventDefault();
          d.onPrevStep();
          return;
        }
        if (e.key === 'ArrowRight' && d.selectionSize === 0) {
          e.preventDefault();
          d.onNextStep();
          return;
        }
      }

      if (d.singleKeyMode === 'off') return;
      const isEraseKey = lower === 'e' || e.key === '8';
      if (isEraseKey && !e.altKey) return; // §7.5f: E 는 기본값에서도 수식키 필요
      if (d.singleKeyMode === 'modifier' && !e.altKey) return;

      // §7.5f/WCAG 2.1.4: g·z 도 다른 단일 문자키와 동일하게 singleKeyMode 게이트를 통과해야 한다
      // (계약이 z 를 이 설정의 존재 이유로 직접 지목한다) — 위 gate 뒤로 옮김.
      if (lower === 'g') {
        d.onToggleGrid();
        return;
      }
      if (lower === 'z') {
        d.onToggleRuleZones();
        return;
      }

      if (lower === 'c' && d.tool === 'cone') {
        d.onConeToggle(); // §6.10 "C 두 번도 토글"
        return;
      }
      const next = toolForKey(lower);
      if (next) {
        e.preventDefault();
        d.onSelectTool(next);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
