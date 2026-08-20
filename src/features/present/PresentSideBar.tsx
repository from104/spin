// 시연 화면 오른쪽 세로 기능 바 — 편집 화면 FunctionBar 와 같은 형식(2026-08-20, 기현님
// 지시: "시연 화면에 오른쪽 기능바를 편집화면의 오른쪽바 형식으로 채워 하단 오른쪽의 재생
// 버튼 셋이 위치가 고정될 수 있게").
//
// 옛 배치는 코트 위에 얹힌 절대위치(`position:absolute`) 버튼 둘(전체화면·도움말)이었다 —
// 코트가 늘 창 폭 전체를 썼고, 그 아래 재생 묶음(PlaybackControls)의 화면상 x좌표가 창 폭에
// 따라 흔들렸다. FunctionBar(features/editor)처럼 코트 오른쪽에 **실제 공간을 차지하는**
// 세로 컬럼을 세우면, 그 폭만큼 코트·노트·진행바 컬럼이 왼쪽으로 줄어들고, 재생 묶음의
// 오른쪽 끝(= 이 바 바로 왼쪽)이 창 폭과 무관하게 항상 같은 자리가 된다 — §3 불변식 1
// (절대 위치로 만드는 공간 기억)을 시연에도 적용한 것이다.
//
// 항목이 둘(전체화면·도움말)뿐이라 FunctionBar 의 구분선·flexWrap 열 계산(functionBarMetrics)
// 은 필요 없다 — 칸 시각 스타일(ITEM/ITEM_LABEL)만 같은 값으로 맞춘다. 두 바가 항목 수·구성이
// 근본적으로 달라(13 대 2) 공용 컴포넌트로 묶기보다 시각 스타일만 값으로 맞추는 쪽을 택했다.
import type { CSSProperties } from 'react';
import { IconFullscreenEnter, IconFullscreenExit, IconHelp } from './icons.tsx';
import type { useFullscreen } from './useFullscreen.ts';
import { useT } from '../../i18n/useT.ts';

/** FunctionBar.tsx 의 ITEM 과 값을 맞춘 칸 하나 — 아이콘 위에 2~4자 이름. */
const ITEM: CSSProperties = {
  flex: 'none',
  width: 'var(--hit)',
  minHeight: 'var(--hit)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  padding: '3px 0',
  borderRadius: 10,
  border: '1px solid transparent',
  background: 'transparent',
  color: 'var(--muted)',
};

/** FunctionBar.tsx 의 ITEM_LABEL 과 같다 — "읽으라고 있는 글자가 아니라 자리를 찾으라고
 *  있는 글자"(그 파일 머리말). */
const ITEM_LABEL: CSSProperties = {
  fontSize: '0.5625rem',
  lineHeight: 1.1,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
};

export interface PresentSideBarProps {
  fullscreen: ReturnType<typeof useFullscreen>;
  onShowHelp(): void;
}

export function PresentSideBar({ fullscreen, onShowHelp }: PresentSideBarProps) {
  const t = useT();
  return (
    <nav
      aria-label={t('present.sideBarAriaLabel')}
      data-present-sidebar=""
      style={{
        flex: 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '13px 6px',
        borderLeft: '1px solid var(--border)',
        background: 'var(--panel)',
      }}
    >
      {/* 이름 규칙(WCAG 2.5.3 Label in Name) — 화면 라벨은 항상 "전체화면"(FunctionBar 의
          [100%]·[속도] 칸과 같은 관례: 라벨은 고정, aria-label 만 상태로 바뀐다). "전체화면"은
          "전체화면 종료"의 부분 문자열이라 종료 상태에서도 규칙이 깨지지 않는다. */}
      <button
        type="button"
        aria-label={fullscreen.state === 'off' ? t('present.fullscreenEnter') : t('present.fullscreenExit')}
        onClick={() => (fullscreen.state === 'off' ? fullscreen.enter({ userGesture: true }) : fullscreen.exit())}
        style={ITEM}
      >
        {fullscreen.state === 'off' ? <IconFullscreenEnter size={18} /> : <IconFullscreenExit size={18} />}
        <span aria-hidden style={ITEM_LABEL}>
          {t('present.fullscreenEnter')}
        </span>
      </button>
      <button type="button" aria-label={t('present.helpAriaLabel')} onClick={onShowHelp} style={ITEM}>
        <IconHelp size={18} />
        <span aria-hidden style={ITEM_LABEL}>
          {t('present.helpAriaLabel')}
        </span>
      </button>
    </nav>
  );
}
