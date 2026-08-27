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
import { COURT_SIZE_LABELS, DEFAULT_COURT_SIZE, type CourtMode, type CourtSize } from '../../model/court.ts';
import { createDrill, DEFAULT_TEAMS } from '../../model/defaults.ts';
import { newId } from '../../core/ids.ts';
import { loadBoard, saveBoard } from '../../storage/board.ts';
import { readBoardSession, writeBoardSession } from './boardSession.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { useSettingsState } from '../../store/settings/SettingsProvider.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { useLibraryActions } from '../../store/library/LibraryProvider.tsx';
import { useAppNav } from '../../app/useAppHistory.ts';
import { EditorProvider, useEditorDispatch, useEditorState } from '../../store/editor/EditorProvider.tsx';
import { PlaybackProvider } from '../../store/playback/PlaybackProvider.tsx';
import { EditorWorkspace } from '../editor/EditorWorkspace.tsx';
// §8 — board 는 library 와 같은 층(screen-home-library)이다. 이름 칸을 공유하려고 다이얼로그
// 둘이 한 파일에 산다(NewDrillDialog.tsx 의 SaveAsDrillDialog 머리말).
import { SaveAsDrillDialog } from '../library/NewDrillDialog.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { Locale } from '../../i18n/locale.ts';
import { translate } from '../../i18n/useT.ts';
import { COURT_DEFS } from '../../model/court.ts';

const PERSIST_DEBOUNCE_MS = 500;

/** 전술판의 시작 코트는 **'full' 고정**이다. 한동안 `prefs.defaultCourtMode` 를 읽었지만
 *  2026-08-21 폐기했다(설정 화면 감사 후속) — 스냅샷·세션 캐시(아래 부팅 ①②)가 코트를
 *  기억하므로 그 설정은 기기당 사실상 최초 1회만 읽혔고, 바꿔도 화면이 안 따라오는 유령
 *  설정이었다. 코트를 바꾸는 자리는 판 위의 코트 전환 하나로 족하다.
 *
 *  **코트는 비어 있다**(empty, 2026-08-10 기현 지시). 전술판에서는 기본 포메이션이 의미가
 *  없다 — 무엇을 그릴지 모르는 판에 8대가 깔려 있으면 매번 치우는 일부터 해야 한다.
 *  선수는 인스펙터 명단에서 하나씩 놓고, 공·콘은 도구로 만든다. `prefs.defaultFormation`
 *  도 같은 날 폐기했다(포메이션은 코치 재량이지 앱이 기본값을 정할 대상이 아니다) —
 *  createDrill 이 formation 을 '1-2-1' 로 접고, [포메이션으로 채우기]·세트피스가 그
 *  drill.formation 을 쓴다. */
function makeBoardDrill(locale: Locale, mode?: CourtMode, size?: CourtSize): Drill {
  return createDrill({
    title: translate(locale, 'board.defaultTitle'),
    courtMode: mode ?? 'full',
    // §6.4 — 고른 코트 크기를 새 판에 물려 준다. 없으면 30×18(§9 ② 부기).
    courtSize: size,
    // 팀은 로케일 기본값으로 태어난다 — 설정의 팀 색상·기본 팀 저장값이 2026-08-21
    // 폐기되면서(로드맵 '팀 색상 변경 기능 폐기') 새 판의 팀은 더 이상 어떤 저장값도 읽지
    // 않는다. DEFAULT_TEAMS 가 색·GK색의 원본이고 라벨만 로케일로 갈아 끼운다. 팀 **이름**은
    // 드릴 편집 ⓘ [드릴 정보] 시트에서 판마다 고친다(§0.5).
    teams: {
      home: { ...DEFAULT_TEAMS.home, label: translate(locale, 'team.defaultHomeLabel') },
      away: { ...DEFAULT_TEAMS.away, label: translate(locale, 'team.defaultAwayLabel') },
    },
    empty: true,
  });
}

export function BoardScreen() {
  const { prefs } = useSettingsState();
  const locale = useLocale();
  // 최초 1회만 판을 정한다. prefs 가 바뀌었다고 그리던 판을 갈아엎으면 안 된다.
  //
  // 부팅 출처는 셋이고 **순서가 곧 계약**이다(2026-08-14 기현님 지시 — boardSession.ts 머리말):
  //   ① 세션 캐시 — 이 세션에서 판을 떠났다 돌아온 경우. 이력·선택·도구까지 그대로 잇는다.
  //   ② localStorage 스냅샷 — 새로고침·새 세션. 배치는 살아나고 이력은 새로 시작한다.
  //   ③ 새 판 — 저장본이 없다.
  const [boot] = useState(() => {
    const session = readBoardSession();
    if (session) return { drill: session.state.present, pristine: session.pristineBase, init: session.state };
    const snap = loadBoard();
    return snap ? { ...snap, init: undefined } : { drill: makeBoardDrill(locale), pristine: true, init: undefined };
  });

  return (
    <EditorProvider drill={boot.drill} init={boot.init}>
      {/* 설정 [재생] > '마지막 스텝에서 반복'. 전술판 재생(useStepPlayback)도 같은 스위치를 본다. */}
      <PlaybackProvider initialLoop={prefs.loop}>
        <BoardHost bootPristine={boot.pristine} />
      </PlaybackProvider>
    </EditorProvider>
  );
}

/** 판 갈아끼우기·스냅샷 저장은 리듀서 상태를 봐야 하므로 Provider **안쪽**에 있어야 한다. */
function BoardHost({ bootPristine }: { bootPristine: boolean }) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const toast = useToast();
  const nav = useAppNav();
  const { refresh } = useLibraryActions();
  const t = useT();
  const locale = useLocale();

  // 저장본 기준선. 판을 갈아끼우면(코트 전환·초기화) 다시 true 가 된다. 실제 게이트는
  // EditorWorkspace 가 여기에 `past.length === 0` 를 AND 해서 만든다.
  const [pristineBase, setPristineBase] = useState(bootPristine);
  const pristine = pristineBase && state.past.length === 0;

  // 스냅샷 저장 — 디바운스. present 참조가 바뀔 때만 돈다(편집 리듀서는 변경 경로만 새 객체를
  // 만든다, §6.7). pristine 을 같이 저장해야 다음에 열었을 때 게이트가 정확해진다.
  const pristineRef = useRef(pristine);
  pristineRef.current = pristine;
  const presentRef = useRef(state.present);
  presentRef.current = state.present;
  // 세션 캐시에 실을 것들. `pristineBase` 는 `pristine`(= base && past.length===0)이 아니라
  // **기준선 자체**다 — 파생값을 저장하면 이력을 그대로 이어받은 판이 다음 마운트에서
  // base=false 로 굳어, 판을 비워도(past 가 0 이 돼도) 코트 전환이 영영 안 열린다.
  const stateRef = useRef(state);
  stateRef.current = state;
  const pristineBaseRef = useRef(pristineBase);
  pristineBaseRef.current = pristineBase;
  useEffect(() => {
    const t = window.setTimeout(() => saveBoard(state.present, pristineRef.current), PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [state.present]);

  // 언마운트 플러시. 위 정리 함수는 타이머를 **저장 없이** 걷으므로, 마지막 편집 뒤 500ms 안에
  // 화면을 떠나면 그 편집이 조용히 사라진다. 드릴 자동저장은 처음부터 이 이펙트를 갖고 있었다
  // (useAutosave.ts 끝 "화면 전환 시 동기 플러시") — 전술판만 없었다.
  //
  // 2026-08-14 에 고치는 이유: 그전에는 [보드]가 드릴 편집을 그대로 두는 바람에 판↔드릴 왕복이
  // 드물었다. 그 결함을 고친 지금은 왕복이 일상 조작이라 이 창이 매번 열린다.
  // saveBoard 는 동기 localStorage 이고 절대 throw 하지 않으므로(storage/board.ts) 정리
  // 함수에서 그대로 부를 수 있다. 마운트당 한 번만 걸어 최신 값은 ref 로 읽는다 — 의존성에
  // present 를 넣으면 **편집할 때마다** 저장이 돌아 디바운스가 통째로 무의미해진다.
  useEffect(() => {
    return () => {
      saveBoard(presentRef.current, pristineRef.current);
      // 같은 자리에서 세션 캐시도 채운다. 디스크에는 배치만, 메모리에는 상태 전부 —
      // 둘의 역할 분담은 boardSession.ts 머리말에 있다.
      writeBoardSession({ state: stateRef.current, pristineBase: pristineBaseRef.current });
    };
  }, []);

  // Ctrl/⌘+S — **디바운스를 건너뛰고 지금 저장한다**(2026-08-15 보드 단축키 정리).
  //
  // 그 전에는 이 키가 드릴의 `autosave.flush()` 로 갔는데, 전술판은 자동저장을 **끈 채**
  // 그 훅을 부르므로(`useAutosave(!isBoard)`) flush 가 첫 줄에서 그냥 돌아왔다 — 즉 눌러도
  // 아무 일도 안 나면서 도움말에는 '저장' 이라고 적혀 있었다. 전술판에도 저장할 것은 있다:
  // 500ms 디바운스로 미뤄 둔 스냅샷이다.
  const saveNow = useCallback(() => {
    saveBoard(presentRef.current, pristineRef.current);
  }, []);

  const swap = useCallback(
    (mode: CourtMode, size?: CourtSize) => {
      dispatch({ type: 'BOARD_SET', drill: makeBoardDrill(locale, mode, size) });
      setPristineBase(true);
    },
    [dispatch, locale],
  );

  const onCourtChange = useCallback(
    (mode: CourtMode) => {
      if (mode === state.present.courtMode) return;
      // ⚠️ 크기를 **물려 준다**. 이 인자가 없던 동안 풀(25×14) → 하프 → 풀 을 왕복하면 고른
      //    코트가 조용히 30×18 로 돌아왔다 — court.ts:269 가 "하프에서도 courtSize 를 들고
      //    다닌다" 고 적어 둔 이유가 바로 이 왕복이다.
      swap(mode, state.present.courtSize);
      toast.show(t('board.courtChangedToast', { label: COURT_DEFS[mode].label[locale] }));
    },
    [state.present.courtMode, state.present.courtSize, swap, toast, t, locale],
  );

  /** §6.4 코트 크기 3단 선택. **판을 비운 상태에서만** 열린다(코트 형태 전환과 같은 문).
   *
   *  ⚠️ `cloneToCourt` 를 쓰지 않는다. 이유 셋:
   *   ① 저 함수는 **새 드릴을 민다**(newId('dr') + 제목에 ' (풀 28 × 15 m)' 접미 + 설명에
   *      '[코트 전환 — 배치를 다시 만들어야 합니다]' 접두). 전술판은 목록에 없는 스냅샷 1장이라
   *      id·제목이 바뀌면 storage/board.ts 의 판이 다른 판으로 갈아치워진 것처럼 보인다.
   *   ② 저 함수는 `defaultStep` 으로 **8대를 깔아 준다**. 전술판은 비어서 뜨는 것이 확정 사항이다
   *      (2026-08-10 기현 지시 — defaults.ts createDrill.empty 주석).
   *   ③ 무엇보다, 여기서는 **잃을 배치가 없다**. 게이트가 pristine 이라 판 위에 개체가 0이고,
   *      그래서 "코트를 줄였더니 선수가 밖에 서 있다" 가 구조적으로 불가능하다 — cloneToCourt 가
   *      해결하려는 문제(좌표를 어떻게 옮길 것인가)가 이 경로에는 아예 발생하지 않는다.
   *  판이 더러우면 이 함수는 불리지 않는다(잠금은 EditorWorkspace 가 건다). */
  const onCourtSizeChange = useCallback(
    (size: CourtSize) => {
      if (size === (state.present.courtSize ?? DEFAULT_COURT_SIZE)) return;
      swap(state.present.courtMode, size);
      toast.show(t('board.courtSizeChangedToast', { size: COURT_SIZE_LABELS[locale][size] }));
    },
    [state.present.courtMode, state.present.courtSize, swap, toast, t, locale],
  );

  const onReset = useCallback(() => {
    // 비우기는 **크기를 유지한다** — 코트를 비웠다고 고른 규격까지 되돌리면, 크기를 고른 뒤
    // 한 번 잘못 놓고 비우는 흔한 동작에서 규격이 조용히 30×18 로 돌아간다.
    swap(state.present.courtMode, state.present.courtSize);
    toast.show(t('board.clearedToast'));
  }, [state.present.courtMode, state.present.courtSize, swap, toast, t]);

  // [저장]은 **이름부터 묻는다**(2026-08-28 기현 지시). 옛 동작(지우지 않는다): 누르는 즉시
  // 판의 제목(없으면 '새 드릴')으로 저장하고 [목록에서 보기] 토스트를 냈다. 이름을 안 붙인
  // 판이 전부 '새 드릴' 로 쌓였고, 목록에 가서야 그것을 알았다.
  const [saveOpen, setSaveOpen] = useState(false);
  const onSaveAsDrill = useCallback(() => setSaveOpen(true), []);

  /** 다이얼로그가 준 이름으로 승격한다. **성공했을 때만** true — 실패하면 모달이 열린 채로
   *  남아야 방금 친 이름을 잃지 않는다. */
  const commitSaveAsDrill = useCallback(
    async (name: string): Promise<boolean> => {
      // 승격은 **복사**다 — 전술판은 그대로 남는다. 저장 직후 판이 사라지면 "방금 그리던 것"을
      // 잃은 것처럼 보인다.
      const now = Date.now();
      const title = name || t('board.defaultDrillTitle');
      const promoted: Drill = { ...structuredClone(state.present), id: newId('dr'), title, createdAt: now, updatedAt: now };
      try {
        const { repo } = await resolveDrillRepo();
        await repo.putDrill(promoted);
        // ★ 반드시 목록을 다시 읽는다. LibraryProvider 는 앱 최상단에서 **한 번만** 로드하므로
        // (App.tsx), 이걸 빼면 IDB 에는 저장됐는데 목록·대문 통계에는 새로고침 전까지 안 뜬다
        // — 사용자에겐 "저장이 안 된 것" 으로 보인다(실제로 그렇게 보였다).
        await refresh();
        toast.show(t('board.savedToast', { title }));
        // 곧장 그 드릴의 편집기로. [목록에서 보기] 토스트 액션은 은퇴했다 — 목록을 거치지
        // 않고 바로 도착하므로 눌러야 할 자리가 없다.
        nav.go('board', { kind: 'drill', id: promoted.id });
        return true;
      } catch {
        toast.show(t('board.saveFailedToast'));
        return false;
      }
    },
    [state.present, toast, nav, refresh, t],
  );

  return (
    <>
      <EditorWorkspace mode="board" board={{ pristine: pristineBase, onCourtChange, onCourtSizeChange, onReset, onSaveAsDrill, onSave: saveNow }} />
      <SaveAsDrillDialog open={saveOpen} onClose={() => setSaveOpen(false)} defaultTitle={state.present.title} onSubmit={commitSaveAsDrill} />
    </>
  );
}
