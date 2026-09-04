// 로더 마크 — `public/logo.svg` 의 도형 6개를 좌표 그대로 옮기고 **회전 그룹만 하나 덧댄** 것
// (PLAN-0-6-3-LOADER-NOTICE 결정 17·18·19·21·32, §5 타임라인).
//
// 왜 `<img src="/logo.svg">` 가 아닌가: 부품(차체·공·마크 전체)이 **따로 움직여야** 하는데
// 이미지로 물면 안이 안 잡힌다. 그래서 도형을 인라인으로 옮기되, 옮긴 것은 좌표뿐이다 —
// `viewBox` 도 값도 정본과 같다. ⚠️ 안쪽 `translate(228 234) rotate(-45)` 그룹의 **내부를
// 만지면 마크가 아닌 것이 된다.** 새로 생긴 것은 그것을 감싸는 `.spin-chair` 하나뿐이다.
//
// 회전축은 차체 도형 중심(228,234)이 아니라 **(180.48, 281.52)** 이다(결정 17). 실제 피벗은
// 뒤에서 길이의 20% 지점(`core/constants.ts` CHAIR, sPivot 0.2)이고, 로컬 x = −112 + 0.2×224 =
// −67.2 를 −45° 로 돌려 루트 좌표로 옮기면 저 점이 나온다. 중심으로 돌리면 ① 앱이 코트에
// 그리는 휠체어와 축이 달라지고 ② 중심 기준 최대반경 hypot(112,65)=129.5 가 공까지의 135 보다
// 짧아 **차체가 공에 닿지 못한다.**
//
// 피벗·transform-box 는 CSS(`styles/a11y.css` 의 `.spin-chair`·`.spin-ball`)에 있다 — 결정 15
// 대로 이 저장소의 모든 키프레임이 거기 살기 때문이고, 값을 여기와 저기 두 벌 두지 않기
// 위해서다. 이 파일이 정하는 것은 **어느 노드가 어느 클래스를 다는가**뿐이다.
//
// 색은 `spinMarkColors.ts`(정본 `public/logo.svg`). 강제색에서도 마크 본체는 presentation
// attribute 라 그대로 보인다(결정 33) — 그것이 fill 속성을 CSS 로 안 옮긴 이유다.
import { BALL_FILL, MARK_CHAIR, MARK_COURT_FILL, MARK_COURT_RIM, MARK_WHITE } from './spinMarkColors.ts';

export interface SpinLoaderMarkProps {
  /** 회전 사이클을 돌릴 것인가. false 면 **정지 자세**(= logo.svg 그대로)에서 멈춘다. */
  animated: boolean;
  /** 한 변의 px. 계산은 `markSizePx`(appLoaderTiming.ts) 한 곳이다. */
  sizePx: number;
  /** 한 바퀴 길이(ms). 백분율 키프레임은 하나이고 이 값만 변주가 바꾼다(결정 21). */
  cycleMs: number;
}

export function SpinLoaderMark({ animated, sizePx, cycleMs }: SpinLoaderMarkProps) {
  // 클래스는 언제나 단다 — 감축 모션·강제색 CSS 셀렉터가 이 이름들을 겨눈다(결정 9·33).
  // 멈추는 것은 `animation-play-state` 로 한다: 사이클 0% 가 곧 정지 자세라(§5) 멈춘 그림이
  // logo.svg 와 정확히 같아진다. 클래스를 떼는 방식이면 그 성질을 CSS 가 아니라 이 파일이
  // 지게 되고, 나중에 시작 프레임을 만지는 사람이 반쪽 자세로 멈춘 마크를 만든다.
  const cycle = { animationDuration: `${cycleMs}ms`, animationPlayState: animated ? 'running' : 'paused' } as const;

  return (
    <svg
      className="spin-mark"
      viewBox="0 0 512 512"
      width={sizePx}
      height={sizePx}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', ...cycle }}
    >
      {/* 코트 바닥 원 두 겹 */}
      <circle cx={256} cy={256} r={248} fill={MARK_COURT_RIM} />
      <circle cx={256} cy={256} r={234} fill={MARK_COURT_FILL} />

      {/* 회전 그룹. 안쪽 그룹은 logo.svg 그대로이고 회전을 모른다. */}
      <g className="spin-chair" style={cycle}>
        <g transform="translate(228 234) rotate(-45)">
          <rect x={-112} y={-65} width={224} height={130} rx={21} fill={MARK_CHAIR} />
          {/* 차체 뒤끝의 흰 파선. 선이 변 위에 놓이므로 반 두께만큼 안으로 들인다.
              행진(stroke-dashoffset)은 바퀴가 돈다는 공짜 단서다 — 저사양에서 프레임이
              떨어지면 §4-5 대로 이 한 줄만 뺀다(다른 것이 여기에 의존하지 않는다). */}
          <path
            className="spin-dash"
            style={cycle}
            d="M-104 -59 V59"
            fill="none"
            stroke={MARK_WHITE}
            strokeWidth={15}
            strokeLinecap="butt"
            strokeDasharray="21 15"
          />
          {/* 머리 — 회전 그룹 **안**이라야 한다. 밖에 두면 차체 축과 무관한 절대 좌표라
              차체가 돌 때마다 엉뚱한 데 찍힌다(logo.svg 주석의 그 지적). */}
          <circle cx={67} cy={0} r={22} fill={MARK_WHITE} />
        </g>
      </g>

      {/* 공은 차체보다 **위**다(logo.svg 의 그리기 순서 그대로) — 겹침 구간에도 안 사라진다(§5). */}
      <circle
        className="spin-ball"
        style={cycle}
        cx={305}
        cy={345}
        r={34}
        fill={BALL_FILL}
        stroke={MARK_COURT_RIM}
        strokeWidth={8}
      />
    </svg>
  );
}
