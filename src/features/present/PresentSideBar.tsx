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
// 2026-08-20(§0.5 Phase 5) — [도움말]이 레일 상시 칸(AppRail·AppNavAside)으로 옮겨가며
// **전체화면 한 칸만 남았다.** 항목이 하나뿐이라 FunctionBar 의 구분선·flexWrap 열 계산
// (functionBarMetrics)은 여전히 필요 없다 — 칸 시각 스타일(ITEM/ITEM_LABEL)만 같은 값으로 맞춘다.
import type { CSSProperties } from 'react';
import { IconFullscreenEnter, IconFullscreenExit } from './icons.tsx';
import { IconDrillInfoRead } from '../../ui/icons.tsx';
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
  /** [정보] — 드릴 정보 모달(읽기 전용)을 연다. 2026-08-28 기현 지시로 헤더 제목 옆 ⓘ 에서
   *  이 바로 이사했다. 없으면 칸을 안 그린다. */
  onDrillInfo?(): void;
}

export function PresentSideBar({ fullscreen, onDrillInfo }: PresentSideBarProps) {
  const t = useT();
  return (
    <nav
      aria-label={t('present.sideBarAriaLabel')}
      data-present-sidebar=""
      data-tut="present-sidebar"
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
      {/* [정보] — 2026-08-28 기현 지시로 헤더 ⓘ 에서 이사. 아이콘이 편집 화면(FunctionBar)의
          같은 칸과 **한 벌**이다: 밑판(정보 카드)이 같고 수정자만 눈 ↔ 연필이다. 여기서는
          **볼 수만 있다**는 뜻이고, 그 사실은 모달을 열기 전에 보여야 한다 — 열고 나서 입력
          칸이 없는 것을 보고 알게 되면 알려 준 것이 아니다.

          ⚠️ **자리가 [전체화면] 뒤 → 맨 위로 바뀌었다**(기현 지시 2026-08-30). 옛 근거를
             지우지 않는다: *"[전체화면] 뒤다. 그 칸은 2026-08-20 부터 이 바의 유일한 칸이었고
             손이 그 자리를 기억한다 — 위에 끼우면 그 좌표가 밀린다(§3 불변식 1)."* 그 대가는
             실재하지만 한 번뿐이고, **편집 화면의 같은 칸과 같은 자리**가 되는 것이 그보다
             크다: 두 화면을 오가는 코치가 [정보]를 같은 높이에서 찾는다. */}
      {onDrillInfo && (
        <button type="button" aria-haspopup="dialog" data-tut="present-info" aria-label={t('present.infoAriaLabel')} onClick={onDrillInfo} style={ITEM}>
          <IconDrillInfoRead size={18} />
          <span aria-hidden style={ITEM_LABEL}>
            {t('present.infoLabel')}
          </span>
        </button>
      )}

      {/* ⚠️ 2026-09-08: 위 [정보] 칸의 튜토리얼 앵커가 `drill-info` → `present-info` 로 바뀌었다
          (docs/PLAN-HELP-OVERHAUL.md §2.2 — 시연 투어가 이 칸을 처음으로 가리킨다).
          옛 이름을 그대로 둘 수 없었던 이유: `drill-info` 는 편집 화면 FunctionBar 의 **고칠 수
          있는** 같은 칸이 이미 쓰는 이름이고(드릴 편집 투어 7단계가 그것을 문다), 한 이름이 두
          화면에서 서로 다른 것(고치기 ↔ 보기 전용)을 뜻하면 어느 투어가 무엇을 가리키는지 코드가
          말해 주지 못한다. 이 앵커를 물고 있던 단계는 **0개**였으므로 깨진 계약은 없다. */}
      {/* 이름 규칙(WCAG 2.5.3 Label in Name) — 화면 라벨은 항상 "전체화면"(FunctionBar 의
          [100%]·[속도] 칸과 같은 관례: 라벨은 고정, aria-label 만 상태로 바뀐다). "전체화면"은
          "전체화면 종료"의 부분 문자열이라 종료 상태에서도 규칙이 깨지지 않는다. */}
      <button
        type="button"
        data-tut="present-fullscreen"
        aria-label={fullscreen.state === 'off' ? t('present.fullscreenEnter') : t('present.fullscreenExit')}
        onClick={() => (fullscreen.state === 'off' ? fullscreen.enter({ userGesture: true }) : fullscreen.exit())}
        style={ITEM}
      >
        {fullscreen.state === 'off' ? <IconFullscreenEnter size={18} /> : <IconFullscreenExit size={18} />}
        <span aria-hidden style={ITEM_LABEL}>
          {t('present.fullscreenEnter')}
        </span>
      </button>

    </nav>
  );
}
