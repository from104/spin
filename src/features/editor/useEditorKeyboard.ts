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

      if (lower === 'g') {
        d.onToggleGrid();
        return;
      }
      if (lower === 'z') {
        d.onToggleRuleZones();
        return;
      }

      if (d.singleKeyMode === 'off') return;
      const isEraseKey = lower === 'e' || e.key === '8';
      if (isEraseKey && !e.altKey) return; // §7.5f: E 는 기본값에서도 수식키 필요
      if (d.singleKeyMode === 'modifier' && !e.altKey) return;

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
