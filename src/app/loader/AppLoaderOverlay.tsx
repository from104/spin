// 로더 오버레이 — 화면을 덮는 불투명 판 한 장 (PLAN-0-6-3-LOADER-NOTICE 결정 3·6·16·31, §5).
//
// **로더는 덮개일 뿐 문이 아니다**(§0). 화면은 지금처럼 동기로 마운트되고, 이 판은 그 위에
// 얹히기만 한다. 그래서 여기에 담기지 **않는** 것들이 계약이다:
//  - 텍스트 0개 · 진행 막대 0개. 아무것도 안 재는 진행 표시는 거짓말이고, 문구는 i18n 3파일과
//    폰트 로드를 물고 들어온다(§5).
//  - 포커스 가능 요소 0개, 루트는 `aria-hidden="true"`(결정 6). 1초짜리 인위적 지연에
//    "불러오는 중" 을 방송하면 전환마다 발표가 두 번이 되어 소음이고, `role="status"` 로 초점을
//    끌면 "로더는 초점을 훔치지 않는다" 를 어긴다. 가려진 컨트롤이 Tab 에 잡히는 문제는
//    덮인 열에 `inert` 를 거는 쪽(AppShell)이 진다.
//  - 아래 화면의 애니메이션 0개. 레일 전환마다 본문이 4px 씩 미끄러지면 그게 곧 소음이다.
//
// ⚠️ `position:'absolute'; inset:0` 은 결정 3 이다. 새 래퍼 `<div>` 를 끼우면 화면 root
// `<main style={{flex:1, overflowY:'auto'}}>` 가 flex 자식 자리를 잃는다 — `AppShell.tsx` 가
// 코트 축척 여유를 **1px** 이라고 스스로 경고하는 그 기둥이다. 절대 위치는 흐름 밖이라
// 기둥을 안 건드린다. body 포털도 검토했으나 레일까지 덮게 되어 결정 2 와 어긋난다.
//
// 등장·퇴장이 keyframes 가 아니라 transition 인 이유는 결정 16 — 퇴장 중에 다음 전환이 들어오면
// 이 컴포넌트를 **재사용해 현재 opacity 값에서 되조준**해야 하는데 keyframes 는 그 중단을 못 한다.
// 그래서 부모가 `visible` 을 껐다 켜도 이 판은 살아 있고, 퇴장이 끝난 뒤에야 스스로 null 이 된다.
//
// ── ⚠️ 2026-09-04 정정: 결정 16 은 **퇴장에만** 남는다 ─────────────────────────────────
// 위 문단은 지우지 않는다(AGENTS §2) — 재사용·되조준이라는 취지는 그대로다. 바뀐 것은 **등장**
// 이다. 옛 구현은 마운트 첫 프레임을 opacity 0 으로 그리고 ENTER_MS 동안 페이드인했는데, 이 판은
// 물러난 화면이 아니라 **새 화면 위에 얹히는 덮개**라 그 페이드인 구간이 곧 "덮으라고 세운 내용이
// 비치는" 구간이었다(헤드리스 실측: 부팅 로더가 반투명인 동안 판이 통째로 비쳐 보였다). 그래서
// 등장은 **첫 프레임부터 opacity 1**(transition 길이 0, 배율 없음)이고, transition 은 퇴장에만
// 남는다. 되조준은 여전히 성립한다 — 퇴장 중에 다음 전환이 오면 길이 0 으로 즉시 1 이 된다.
//
// 클래스 이름은 `styles/a11y.css` 와의 계약이다 — 루트 `.spin-loader`(감축 모션·강제색이 겨눈다),
// 마크 안쪽은 `.spin-mark`·`.spin-chair`·`.spin-ball`·`.spin-dash`. 이름을 바꾸려면 두 파일을
// 같은 커밋에서 바꾼다. 사이클 길이만 여기서 인라인으로 내려간다(변주 둘이 duration 만 다르다).
//
// ⚠️ `visible` 이 **한 번도 참이 된 적 없으면 null 을 돌려준다** — 0ms 환경(감축 모션·테스트)에서
// 오버레이 DOM 이 트리에 한 번도 안 생긴다는 §7-2 의 성질이 여기서 완성된다. 부모가 조건부로
// 마운트하지 않아도 되도록 이 파일이 지는 몫이다.
//
// ── ⚠️ 2026-09-04: **"걷힘" 은 `visible === false` 가 아니라 퇴장 완료다** ─────────────────
// 이 판은 `visible` 이 꺼진 뒤에도 `EXIT_MS`(160~200ms) 동안 살아 opacity 를 1 → 0 으로 녹인다
// (위 결정 16). 그 구간은 사람 눈에 **아직 덮여 있는** 구간이다 — 실측에서 퇴장 페이드 도중
// 프레임에 튜토리얼 말풍선(z 300)이 아직 거의 불투명한 판 위에 이미 떠 있었다. 결정 30 의 순서
// (로더 걷힘 → 안내 모달 닫힘 → 튜토리얼 시작)에서 첫 칸이 끝나는 시점은 그래서 `visible` 이
// 아니라 **이 판이 스스로 트리에서 사라지는 순간**이고, 그 순간을 밖에 알리는 것이 `onExited` 다.
// 판 자신 말고는 아무도 그 시점을 알 수 없다 — 퇴장 길이는 `kind` 마다 다르고, 퇴장 중에 다음
// 전환이 들어오면 되조준되어 아예 오지 않는다.
import { useEffect, useRef, useState } from 'react';
import { CYCLE_MS, EXIT_MS, markSizePx } from './appLoaderTiming.ts';
import type { AppLoaderKind } from './appLoaderTiming.ts';
import { SpinLoaderMark } from './SpinLoaderMark.tsx';

/** 로더가 서는 층. Modal(200) 위 — 전환 중에는 아무것도 안 보여야 한다. TutorialOverlay(300)
 *  아래 — 튜토리얼 스포트라이트가 로더에 가리면 안 된다(결정 31). 셋이 실제로 겹치는 일은
 *  결정 30 의 순서 규칙(로더 → 안내 → 튜토리얼)이 없앤다. */
const LOADER_Z = 220;

export interface AppLoaderOverlayProps {
  visible: boolean;
  kind: AppLoaderKind;
  /** 감축 모션이면 등장·퇴장에서 **transform 을 빼고 opacity 만** 남긴다(§5).
   *  오늘은 도달하지 않는 갈래다 — 결정 8 대로 감축 모션에서는 로더가 애초에 안 뜬다.
   *  나중에 `pending` 이 붙어 로더가 실제 대기를 덮게 되는 날을 위한 자리이고, 그때
   *  인라인 transform 을 CSS 로 덮을 수 없으므로(우선순위) 값 자체를 여기서 지운다. */
  reduceMotion?: boolean;
  /** 퇴장 transition 이 끝나 이 판이 스스로 트리에서 사라지는 그 시점에 **한 번** 불린다
   *  (위 「걷힘 은 퇴장 완료다」). ⚠️ `visible` 이 한 번도 참이 아니었던 0ms 환경에서는 퇴장
   *  자체가 없으므로 **절대 안 불린다** — 그 환경에서 부모가 이 신호를 기다리면 영영 못 받는다.
   *  그래서 부모의 초기값은 "이 환경에서 덮개가 애초에 서는가" 로 정해야 한다(AppShell). */
  onExited?: () => void;
}

export function AppLoaderOverlay({ visible, kind, reduceMotion = false, onExited }: AppLoaderOverlayProps) {
  /** 트리에 남아 있는가. 퇴장 transition 이 끝날 때까지 `visible` 보다 오래 산다. */
  const [mounted, setMounted] = useState(visible);
  // 콜백은 ref 로 읽는다 — 아래 effect 의 의존성에 넣으면 부모가 인라인 화살표를 넘길 때마다
  // 퇴장 타이머가 clear 되고 처음부터 다시 걸려 **퇴장이 영영 안 끝난다**(부모가 퇴장 중에
  // 재렌더하는 것은 흔하다 — 발표 예약 state 하나만으로도 그렇게 된다).
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  // 등장은 **렌더 중**에 정한다(effect 가 아니라) — `useAppLoader` 가 열쇠 변화를 렌더 중에
  // 보는 것과 같은 규율이다(그 파일 머리말). 판이 같은 커밋에 서는 것 자체는 아래 null 조건이
  // `visible` 도 보므로 이 줄이 없어도 성립하지만, 그러면 `mounted` 가 한 커밋 동안 거짓이라
  // **그 사이에 `visible` 이 꺼지면 퇴장 없이 사라진다**(결정 5 의 "아무 입력에 즉시 걷기" 가
  // 아주 이른 입력을 받는 경우). 상태와 화면을 같은 커밋에서 맞춰 두는 쪽이 그 갈래를 없앤다.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    // 퇴장 타이머는 걷힐 때만. `visible` 이 다시 켜지면 이 effect 가 다시 돌며 앞 타이머를
    // 정리해(cleanup) 판을 그대로 재사용한다 — 결정 16 의 되조준이다.
    if (visible || !mounted) return undefined; // 한 번도 안 뜬 판에는 타이머도 안 만든다(§7-2).
    const t = window.setTimeout(() => {
      setMounted(false);
      // ★ 타이머가 사는 유일한 조건이 "한 번은 떴다" 이므로(위 줄) 0ms 환경에서는 여기 못 온다.
      onExitedRef.current?.();
    }, EXIT_MS[kind]);
    return () => window.clearTimeout(t);
  }, [visible, kind, mounted]);

  if (!visible && !mounted) return null;

  /** 퇴장 중인가. 등장에는 길이가 없다(위 「2026-09-04 정정」) — 덮개가 반투명인 구간이 곧
   *  덮으려던 내용이 비치는 구간이라, 등장은 첫 프레임부터 완전히 불투명하다. */
  const exiting = !visible;
  const durationMs = exiting ? EXIT_MS[kind] : 0;
  // 퇴장은 밀려나는 게 아니라 **다가와서 녹는다**(§5) — 로더가 물러나는 것이 아니라 앱이
  // 열리는 것으로 읽힌다. 그래서 나갈 때만 scale 이 1 을 넘는다(등장 배율은 없다).
  const scale = exiting ? 1.06 : 1;
  const viewportMinPx =
    typeof window === 'undefined' ? 800 : Math.min(window.innerWidth, window.innerHeight);

  return (
    <div
      className="spin-loader"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: LOADER_Z,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 불투명이라야 덮는다 — 반투명이면 전환 중 옛 화면이 비쳐 "덜 지워진" 것으로 읽힌다.
        // 강제색에서는 `a11y.css` 의 `.spin-loader` 가 이 값을 `Canvas` 로 덮는다(결정 33).
        background: 'var(--bg)',
        opacity: exiting ? 0 : 1,
        // ★ 퇴장 중에는 입력을 통과시킨다. `inert` 는 `visible` 과 같이 떨어지는데 이 판은
        // 퇴장 transition 동안 더 살아 있어(위 결정 16), 그 사이 화면은 열린 것으로 보이는데
        // 맨 위의 투명해져 가는 판이 히트테스트를 가져가 그 탭이 통째로 증발한다. 사라져 가는
        // 것이 입력을 먹으면 사람은 "눌렀는데 아무 일도 없다" 를 보고 다시 누른다.
        // 떠 있는 동안(`!exiting`)은 값을 안 준다 — `inert` 를 모르는 구형 브라우저(§8-2)에서
        // 불투명한 판이 가린 컨트롤을 눌러 버리는 것을 이 판이 대신 막아 준다.
        pointerEvents: exiting ? 'none' : undefined,
        // 길이 0 이면 등장은 즉시다. 퇴장 값과 목표 opacity 를 같은 스타일 변화에 실어도
        // transition 은 **변화 뒤 스타일**의 길이를 쓰므로 퇴장은 그대로 애니메이션된다.
        transition: `opacity ${durationMs}ms cubic-bezier(.4,0,.2,1)`,
      }}
    >
      {/* 배율은 **루트가 아니라 이 속싸개**가 진다. 루트를 키우면 불투명 바탕이 같이 커져
          퇴장에서 넘친다(옛 등장 배율 0.94 도 같은 이유로 여기 있었다 — 루트를 줄이면 줄어든
          만큼 가장자리로 아래 화면이 비쳤다. 그 등장 배율 자체는 2026-09-04 에 사라졌다).
          `.spin-mark`(svg)에 걸지 않는 것은 a11y.css 의 계약 1 이다 — 그 요소는 임팩트 펄스로
          transform 을 이미 애니메이션하고 있고, 실행 중인 애니메이션은 같은 속성의 transition 을
          이겨 배율이 소리 없이 무시된다. 곡선은 앱 표준 easeStandard(core/geom.ts). */}
      <div
        style={{
          transform: reduceMotion ? undefined : `scale(${scale})`,
          transition: reduceMotion ? undefined : `transform ${durationMs}ms cubic-bezier(.4,0,.2,1)`,
        }}
      >
        <SpinLoaderMark
          animated={!reduceMotion}
          sizePx={markSizePx(kind, viewportMinPx)}
          cycleMs={CYCLE_MS[kind]}
        />
      </div>
    </div>
  );
}
