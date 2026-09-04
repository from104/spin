// 화면 로더의 상태기계 (PLAN-0-6-3-LOADER-NOTICE 결정 5·8·11·12·13, §5).
//
// 이 훅이 지는 것은 **언제 덮개를 씌우고 언제 걷는가** 하나뿐이다. 무엇을 그리는지는
// `AppLoaderOverlay`·`SpinLoaderMark` 가, 얼마나 오래인지는 `appLoaderTiming.ts` 가 진다.
//
// ⚠️ **0ms 경로가 이 파일의 핵심 계약이다.** `loaderMinMs` 가 0 을 돌려주는 환경(감축 모션·
// 테스트)에서는 `visible` 이 **초기값부터 false** 다 — true 였다 꺼지는 중간 프레임이 없고,
// 그래서 오버레이 DOM 도 타이머도 document 리스너도 트리에 **한 번도 안 생긴다.** 이 성질이
// 기존 렌더 테스트 6개를 무개조로 통과시키는 근거이고(§7), "로더가 뜨든 안 뜨든 앱의 동작·발표·
// 포커스 계약이 같다" 는 §0 원칙의 실행이다. 초기값을 true 로 바꾸고 effect 에서 끄는 꼴로
// 고치면 그 계약이 조용히 죽는다.
//
// 왜 열쇠 하나로 도는가: 전환 판정을 화면·대상·이력으로 조합하면 "왜 여기선 안 뜨나" 를
// 재현할 수 없게 된다. 열쇠 계산은 `loaderKeyFor.ts` 한 곳이고 이 훅은 값이 **바뀌었다**는
// 사실만 본다.
//
// ⚠️ **열쇠 변화는 effect 가 아니라 렌더 중에 본다**(2026-09-04 실측 뒤 수정). 덮개는 덮을
// 화면과 **같은 커밋**에 서야 한다 — effect 로 미루면 새 화면이 먼저 맨몸으로 커밋되고 로더는
// 그다음 커밋에 올라온다. 헤드리스 실측에서 레일 클릭 0ms 프레임에 새 화면이 로더 없이 잡히고
// 232ms 프레임부터 로더가 그 위로 올라오는 것이 그 한 커밋의 그림이었다. 같은 커밋에 서야
// 오버레이·`aria-busy`·`inert`·튜토리얼 게이트(결정 30)가 **함께** 선다.
//
// 관련: `docs/PLAN-0-6-3-LOADER-NOTICE.md` §1(결정)·§5(타임라인)·§7(테스트 계획).
import { useEffect, useMemo, useRef, useState } from 'react';
import { loaderMinMs } from './appLoaderTiming.ts';
import type { AppLoaderKind } from './appLoaderTiming.ts';

export interface UseAppLoaderOptions {
  /** 전환 열쇠(`loaderKeyFor`). 값이 바뀌면 전환 로더가 한 회 뜬다. */
  key: string;
  /** 감축 모션 실효값. 호출부가 `effectiveReduceMotion(prefs.a11y.reduceMotion)` 으로 접어서 넘긴다. */
  reduceMotion: boolean;
  /** 첫 방문 로더를 건너뛴다. 프리렌더 착지(결정 13)에서 `LANDED_ON_PRERENDER` 가 들어온다. */
  skipBoot: boolean;
  /** 이번 전환이 뒤로/앞으로가기에서 왔는가(결정 11). 참이면 열쇠가 바뀌어도 한 회 면제한다. */
  fromHistory: boolean;
  /** 아직 덮을 실제 일이 남았는가. **이번 릴리스에서는 아무도 안 넘긴다**(결정 1 — React.lazy
   *  미도입). 나중에 `<Suspense>` 대기 신호를 여기 물리면 게이트가 "타이머 AND 일 끝남" 이 된다. */
  pending?: boolean;
}

export interface AppLoaderState {
  visible: boolean;
  kind: AppLoaderKind;
}

interface InternalState extends AppLoaderState {
  /** 타이머 재시작 나수. 레일 연타처럼 **같은 kind 로 다시 뜨는** 전환에서 앞 타이머를 확실히
   *  끊기 위한 것이다 — 이 값이 없으면 `{visible:true, kind:'rail'}` 이 그대로라 살림 effect 가
   *  다시 안 돌고, 앞 화면의 남은 시간이 뒤 화면을 **조기 종료**시킨다(결정 11 의 그 금지). */
  seq: number;
}

export function useAppLoader(opts: UseAppLoaderOptions): AppLoaderState {
  const { key, reduceMotion, skipBoot, fromHistory, pending = false } = opts;

  const [state, setState] = useState<InternalState>(() => ({
    kind: 'boot',
    // 첫 마운트 = 부팅 로더. 단 프리렌더 착지면 건너뛴다(결정 13), 0ms 환경이면 애초에 안 뜬다.
    visible: !skipBoot && loaderMinMs('boot', reduceMotion) > 0,
    seq: 0,
  }));

  // 최신값을 effect 의 의존성으로 올리지 않고 ref 로 읽는다. 이유는 값이 아니라 **사건**이
  // 방아쇠이기 때문이다: `pending`·`reduceMotion` 이 바뀌었다고 로더를 다시 띄워서도 안 된다.
  // (`fromHistory` 는 ref 가 필요 없다 — 아래 판정이 렌더 중이라 **열쇠가 바뀌는 그 렌더의
  //  값**을 그대로 읽는다. 전환 뒤에 false 로 돌아오는 것은 열쇠를 안 바꾸므로 안 보인다.)
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  /** 최소 표시 시간이 이미 지났는가. `pending` 이 붙는 날의 두 번째 게이트다. */
  const minElapsedRef = useRef(false);

  // ── 열쇠가 바뀌면 전환 로더 (렌더 중 파생 — effect 아님) ─────────────────
  // React 가 허용하는 "props 가 바뀌면 렌더 중 setState" 패턴이다: 조건이 붙어 있어 무한
  // 재렌더가 아니고, 자기 컴포넌트의 상태만 갱신하며, React 는 이 커밋을 화면에 내보내기 전에
  // 곧바로 다시 렌더한다. 그래서 **새 화면이 커밋되는 그 커밋에 `visible` 이 이미 true** 다.
  // ⚠️ 이것을 effect 로 되돌리지 마라 — 되돌리는 순간 전환 직후 한 프레임 동안 새 화면이
  // 덮개 없이 보이고, 같은 프레임에 튜토리얼 게이트가 열려 말풍선이 로더 위에 뜬다(머리말).
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    // 뒤로가기가 갈 때보다 느려지면 안 된다(결정 11). 면제는 이번 전환 한 회뿐이다.
    // 0ms 환경(감축 모션·테스트)은 여기서 걸러져 `visible` 이 한 번도 참이 되지 않는다.
    if (!fromHistory && loaderMinMs('rail', reduceMotion) > 0) {
      setState((s) => ({ kind: 'rail', visible: true, seq: s.seq + 1 }));
    }
  }

  // ── 로더가 떠 있는 동안의 살림: 최소시간 타이머 + 아무 입력에 즉시 걷기 ──
  useEffect(() => {
    if (!state.visible) return undefined;
    const minMs = loaderMinMs(state.kind, reduceMotionRef.current);
    if (minMs <= 0) {
      setState((s) => ({ ...s, visible: false }));
      return undefined;
    }

    let closed = false;
    const close = (): void => {
      if (closed) return;
      closed = true;
      setState((s) => ({ ...s, visible: false }));
    };

    minElapsedRef.current = false;
    const timer = window.setTimeout(() => {
      minElapsedRef.current = true;
      // 덮을 일이 남았으면 계속 덮는다. 이번 릴리스에서 `pending` 은 항상 false 다.
      if (!pendingRef.current) close();
    }, minMs);

    // 인위적 지연의 유일한 실질 결함(급한 사람이 갇힌다)을 없앤다(결정 5). capture 로 듣되
    // preventDefault 를 **하지 않는다** — 로더를 걷은 그 키·클릭은 그대로 앱에 닿아야 한다.
    // passive 는 wheel 이 스크롤을 막지 않게 하려는 것이고, 세 리스너 모두 같은 규율이다.
    const listenOpts = { capture: true, passive: true } as const;
    document.addEventListener('pointerdown', close, listenOpts);
    document.addEventListener('keydown', close, listenOpts);
    document.addEventListener('wheel', close, listenOpts);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close, true);
      document.removeEventListener('wheel', close, true);
    };
  }, [state.visible, state.kind, state.seq]);

  // 최소시간이 이미 지난 뒤 `pending` 이 풀리는 경우. 오늘은 도달하지 않는 갈래이지만,
  // 여기가 비어 있으면 `pending` 을 붙이는 사람이 타이머 쪽만 고쳐 영영 안 걷히는 로더를 만든다.
  useEffect(() => {
    if (!state.visible || pending || !minElapsedRef.current) return;
    setState((s) => ({ ...s, visible: false }));
  }, [pending, state.visible]);

  return useMemo(() => ({ visible: state.visible, kind: state.kind }), [state.visible, state.kind]);
}
