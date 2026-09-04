// 라디오/토글 한 줄의 **두 줄 내용** — 이름 아래에 한 줄짜리 설명을 세운다.
//
// ── 왜 있는가 (2026-08-29) ──────────────────────────────────────────────────────────────
// 코트 형태·크기 선택지의 설명은 `title` 툴팁에만 있었다. **툴팁은 터치에서 뜨지 않는다** —
// 태블릿으로 앱을 여는 코치는 "하프"·"플랫"이 무엇인지 알 방법이 없었다. 그리고 이건 처음
// 드릴을 만들 때 **가장 먼저 내리는 결정**이라, 설명이 없으면 고를 수가 없다.
//
// ⚠️ 모달에 설명 문단을 되살리는 것이 아니다(2026-08-27 지시 *"모달에서 설명을 최소화"*).
//    그때 지운 것은 **아무 일도 없다는 것을 알리던 줄**이었고, 이건 선택지 자체의 내용이다 —
//    무엇을 고르는지 모르는 채로 고르게 두는 것은 설명이 적은 게 아니라 없는 것이다.
//    한 번 읽으면 되는 *까닭*은 여전히 도움말로 간다. 여기 오는 것은 매번 필요한 *구분*뿐이다.
//
// `title` 은 그대로 둔다 — 마우스에는 여전히 뜨고, 길이 제한이 없어 더 긴 문장을 담을 수 있다.
//
// ⚠️ 호출부에 **스타일 상수를 넘기지 않는다.** 세로 쌓기를 안쪽 `<span>` 이 스스로 진다 —
//    그래야 부르는 쪽이 자기 버튼 스타일(테두리·강조 어휘)을 그대로 두고 내용만 바꿀 수 있고,
//    이 파일이 컴포넌트 하나만 내보내게 된다.
import type { CSSProperties, ReactNode } from 'react';

const STACK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  padding: '6px 0',
  lineHeight: 1.35,
  minWidth: 0,
};

/** 설명 줄 — 이름보다 작고 흐리다. 이름과 같은 굵기·크기로 두면 두 줄 다 이름처럼 읽힌다. */
const DESC: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 400,
  color: 'var(--faint-text)',
  // 좁은 창에서 한 줄 설명이 두세 줄로 접히는 것은 정상이다 — 자르지 않는다(잘린 설명은
  // 툴팁과 같은 문제로 돌아간다: 끝을 보려면 다른 수단이 필요해진다).
  whiteSpace: 'normal',
};

export function OptionText({ label, desc }: { label: string; desc?: string }): ReactNode {
  return (
    <span style={STACK}>
      <span>{label}</span>
      {desc ? <span style={DESC}>{desc}</span> : null}
    </span>
  );
}
