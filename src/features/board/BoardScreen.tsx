// §6.8 재편 — 대문(board)에 상시 떠 있는 자유 전술판. 드릴 편집기와 **같은 컴포넌트**
// (EditorWorkspace)를 mode='board' 로 쓴다. 판을 그리는 부분(도구·코트·속성)은 한 줄도 다르지
// 않고, 다른 것은 이 화면이 쥐고 있는 세 가지뿐이다:
//
//   ① 스냅샷 1장의 수명 (storage/board.ts — 목록에 뜨지 않는 임시 판)
//   ② 코트 자유 전환 게이트의 기준선(pristine)
//   ③ 정식 드릴로의 승격
//
// 드릴을 열었을 때는 이 화면이 아니라 EditorScreen 이 같은 자리에 mode='drill' 로 뜬다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Drill } from '../../model/drill.ts';
import type { CourtMode } from '../../model/court.ts';
import { createDrill } from '../../model/defaults.ts';
import { newId } from '../../core/ids.ts';
import { loadBoard, saveBoard } from '../../storage/board.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { Preferences } from '../../storage/prefs.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useLibraryActions } from '../../store/library/LibraryProvider.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { EditorProvider, useEditorDispatch, useEditorState } from '../../store/editor/EditorProvider.tsx';
import { PlaybackProvider } from '../../store/playback/PlaybackProvider.tsx';
import { EditorWorkspace } from '../editor/EditorWorkspace.tsx';

const PERSIST_DEBOUNCE_MS = 500;

/** 전술판의 시작 코트는 `prefs.defaultCourtMode` 다 — CourtPicker 가 은퇴하면서 그 설정이
 *  죽은 필드가 되지 않도록 여기가 유일한 소비처가 됐다(감사 minor #4 의 후신).
 *
 *  **코트는 비어 있다**(empty, 2026-08-10 기현 지시). 전술판에서는 기본 포메이션이 의미가
 *  없다 — 무엇을 그릴지 모르는 판에 8대가 깔려 있으면 매번 치우는 일부터 해야 한다.
 *  선수는 인스펙터 명단에서 하나씩 놓고, 공·콘은 도구로 만든다. */
function makeBoardDrill(prefs: Preferences, mode?: CourtMode): Drill {
  return createDrill({
    title: '자유 전술판',
    courtMode: mode ?? prefs.defaultCourtMode ?? 'full',
    formation: prefs.defaultFormation,
    teams: prefs.teams,
    empty: true,
  });
}

export function BoardScreen() {
  const { prefs } = useSettingsState();
  // 최초 1회만 판을 정한다. prefs 가 바뀌었다고 그리던 판을 갈아엎으면 안 된다.
  const [boot] = useState(() => loadBoard() ?? { drill: makeBoardDrill(prefs), pristine: true });

  return (
    <EditorProvider drill={boot.drill}>
      <PlaybackProvider>
        <BoardHost bootPristine={boot.pristine} />
      </PlaybackProvider>
    </EditorProvider>
  );
}

/** 판 갈아끼우기·스냅샷 저장은 리듀서 상태를 봐야 하므로 Provider **안쪽**에 있어야 한다. */
function BoardHost({ bootPristine }: { bootPristine: boolean }) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const { prefs } = useSettingsState();
  const toast = useToast();
  const nav = useAppNav();
  const { refresh } = useLibraryActions();

  // 저장본 기준선. 판을 갈아끼우면(코트 전환·초기화) 다시 true 가 된다. 실제 게이트는
  // EditorWorkspace 가 여기에 `past.length === 0` 를 AND 해서 만든다.
  const [pristineBase, setPristineBase] = useState(bootPristine);
  const pristine = pristineBase && state.past.length === 0;

  // 스냅샷 저장 — 디바운스. present 참조가 바뀔 때만 돈다(편집 리듀서는 변경 경로만 새 객체를
  // 만든다, §6.7). pristine 을 같이 저장해야 다음에 열었을 때 게이트가 정확해진다.
  const pristineRef = useRef(pristine);
  pristineRef.current = pristine;
  useEffect(() => {
    const t = window.setTimeout(() => saveBoard(state.present, pristineRef.current), PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state.present]);

  const swap = useCallback(
    (mode: CourtMode) => {
      dispatch({ type: 'BOARD_SET', drill: makeBoardDrill(prefs, mode) });
      setPristineBase(true);
    },
    [dispatch, prefs],
  );

  const onCourtChange = useCallback(
    (mode: CourtMode) => {
      if (mode === state.present.courtMode) return;
      swap(mode);
      const label = { full: '풀 코트', half: '하프 코트', flat: '플랫 코트' }[mode];
      toast.show(`${label}로 바꿨습니다.`);
    },
    [state.present.courtMode, swap, toast],
  );

  const onReset = useCallback(() => {
    swap(state.present.courtMode);
    toast.show('코트를 비웠습니다. 이제 코트 형태를 바꿀 수 있습니다.');
  }, [state.present.courtMode, swap, toast]);

  const onSaveAsDrill = useCallback(() => {
    // 승격은 **복사**다 — 전술판은 그대로 남는다. 저장 직후 판이 사라지면 "방금 그리던 것"을
    // 잃은 것처럼 보인다.
    const now = Date.now();
    const title = state.present.title.trim() || '새 드릴';
    const promoted: Drill = { ...structuredClone(state.present), id: newId('dr'), title, createdAt: now, updatedAt: now };
    void (async () => {
      try {
        const { repo } = await resolveDrillRepo();
        await repo.putDrill(promoted);
        // ★ 반드시 목록을 다시 읽는다. LibraryProvider 는 앱 최상단에서 **한 번만** 로드하므로
        // (App.tsx), 이걸 빼면 IDB 에는 저장됐는데 목록·대문 통계에는 새로고침 전까지 안 뜬다
        // — 사용자에겐 "저장이 안 된 것" 으로 보인다(실제로 그렇게 보였다).
        await refresh();
        toast.show(`'${title}' 드릴로 저장했습니다.`, {
          action: { label: '목록에서 보기', onAction: () => nav.go('drills') },
        });
      } catch {
        toast.show('드릴로 저장하지 못했습니다. 저장 공간을 확인해 주세요.');
      }
    })();
  }, [state.present, toast, nav, refresh]);

  return <EditorWorkspace mode="board" board={{ pristine: pristineBase, onCourtChange, onReset, onSaveAsDrill }} />;
}
