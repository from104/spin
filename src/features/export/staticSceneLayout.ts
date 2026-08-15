// §6.2 PNG — **글자의 자리**와 **출력 크기**. 순수 계산만 있다(DOM·캔버스·React 없음).
//
// ★ [A-9] 이 파일이 존재하는 이유: 내보낸 SVG 에는 `<text>` 를 **한 개도** 넣지 않는다.
//   img 컨텍스트 안 SVG 의 `@font-face` 로드는 비동기라 `img.onload` 직후 `drawImage` 해도
//   폰트가 안 실린 채 래스터되는 형태가 알려져 있고, 그러면 **등번호가 빠진 PNG** 가 나온다 —
//   코치는 그게 실패인지 알 수 없다. 한글(제목·메모)은 더 나쁘다: 저장소의 Space Grotesk
//   서브셋은 U+0000-00FF 뿐이라(fonts.css:43-61) 글리프가 통째로 빈다.
//   그래서 텍스트는 전부 **문서 컨텍스트의 캔버스**(이미 Pretendard·Space Grotesk 가 로드돼
//   있다)에서 그린다. 이 파일은 그때 필요한 것 — 문자열·중심좌표·크기·색·정렬 — 을
//   `TextPlacement[]` 로 돌려주고, 어댑터(rasterize.ts)는 그걸 그대로 `fillText` 한다.
//
// ★ [A-10] `width`/`height` 를 반드시 명시한다. viewBox 만 있는 SVG 는 `<img>` 에서 내재
//   크기가 불확정이라 브라우저 기본 300×150 으로 그려져 **PNG 가 뭉개진다.**
import { courtDefFor, type CourtMode, type CourtSize } from '../../model/court.ts';
import type { TeamSide, TeamStyle } from '../../model/drill.ts';
import type { RenderFrame } from '../../model/playback.ts';
import { CHAIR, NOTE } from '../../core/constants.ts';
import { pointAtLever } from '../../model/chair.ts';
// 쪽지 칩 폭의 유일한 출처. 칩을 그리는 쪽(buildStaticSvg)과 글자를 얹는 쪽(이 파일)이
// 같은 폭을 봐야 글이 칩 밖으로 새지 않는다 — render 쪽 순수 함수를 **읽기만** 한다.
import { noteChipWidthPx } from '../../render/objects/noteChip.ts';
import { safeColor } from './svgSafe.ts';
import { teamMarkFor } from './teamMark.ts';

/** 그림 아래에 붙는 한 줄 캡션. 없으면(`null`) 캡션 띠 자체를 만들지 않는다. */
export interface SceneCaption {
  /** 드릴 제목. 자유 전술판이면 '자유 전술판' 같은 화면 제목을 넣는다. */
  title: string;
  /** 0-based. 화면에는 +1 해서 찍는다. */
  stepIndex: number;
  stepCount: number;
  stepName: string;
}

export interface StaticSceneOpts {
  mode: CourtMode;
  /** §5.1/§6.4 코트 크기 3단. **출력 픽셀 크기와 캡션 띠 위치가 여기서 나온다** — 빼먹으면
   *  25×14 드릴의 PNG 가 825×525 캔버스에 그려져 오른쪽·아래에 빈 띠가 생기고, 캡션은
   *  코트 위로 100 px 올라와 개체를 덮는다. */
  size?: CourtSize;
  teams: Record<TeamSide, TeamStyle>;
  /** 진영 — `ruleZones[0]` 을 지키는 팀(`Drill.defense`). 골 지역 3인 반칙이 **수비 팀만**
   *  세므로(2026-08-15), 이 값을 안 넘기면 PNG 만 다른 팀을 붉게 칠한다. 생략하면
   *  `defaultDefense(mode)` 다 — 화면과 같은 폴백이라야 두 그림이 갈라지지 않는다. */
  defense?: TeamSide;
  /** 1x = 긴 변 1024, 2x = 2048(계획서 §6.2 [A-10] 목표 해상도). 기본 2x —
   *  인쇄물로 옮기는 것이 목적이라 화면 devicePixelRatio 가 아니라 출력 해상도를 기준으로 잡는다. */
  resolution?: 1 | 2;
  /** 'white' = 카톡·밴드에 붙였을 때 둥근 모서리 바깥이 흰색. 'transparent' = 문서에 겹치기용. */
  background?: 'white' | 'transparent';
  /** 격자 **선**만 그린다. 칸 라벨은 §6.2 표가 '안 담긴다' 로 못박았다(글자이기도 하다). */
  showGrid?: boolean;
  /** 규칙 존 + 3 m 링. 화면의 `prefs.showRuleZones` 와 **같은 스위치**를 넘긴다. */
  showRuleZones?: boolean;
  caption?: SceneCaption | null;
}

/** 월드 px 단위 레이아웃 상수. 코트 좌표는 여기 없다 — 전부 `COURT_DEFS` 에서 온다. */
export const EXPORT_LAYOUT = {
  /** 1x 출력의 긴 변(px). 2x 가 계획서의 목표 2048 이다. */
  baseLongEdgePx: 1024,
  /** 캡션 띠 높이(월드 px). 두 줄(제목 20 + 부제 14)에 위아래 여백. */
  captionBandPx: 46,
  captionPadXPx: 14,
  captionTitleSizePx: 20,
  captionSubSizePx: 14,
  /** 제목·부제의 **세로 중심**(띠 위 기준). */
  captionTitleCy: 16,
  captionSubCy: 34,
  /** 코트 배경 사각형의 둥근 모서리 — PresentStage 와 같은 값(썸네일 14 가 아니다). */
  courtRx: 16,
  /** 칩에 찍는 글자 크기. ChairChip.tsx 의 `LABEL_FONT_PX` 와 같은 유도식이다
   *  (원래 20, 2026-08-11 기현 지시로 2/3). 다르면 내보낸 그림의 등번호만 화면과 크기가 다르다. */
  chipLabelSizePx: (20 * 2) / 3,
  chipLabelWeight: 700,
  noteTextWeight: 600,
} as const;

/** 흰 배경일 때의 캡션 색. */
const CAPTION_INK_ON_WHITE = { title: '#111827', sub: '#4b5563' } as const;
/** 투명 배경일 때는 캡션 띠를 **불투명하게 깔고**(buildStaticSvg) 그 위에 흰 글자를 얹는다 —
 *  투명 위 검은 글자는 어두운 배경에 붙이면 사라진다. '투명'은 코트 모서리 바깥에만 남는다. */
const CAPTION_INK_ON_DARK = { title: '#ffffff', sub: 'rgba(255,255,255,.72)' } as const;
/** 투명 배경에서 캡션 띠에 까는 색. 메모 쪽지와 같은 먹색(colors.ts `NOTE_FILL` 근거 공유). */
export const CAPTION_BAND_FILL = '#0f1a14';

export interface SceneMetrics {
  /** 코트 viewBox. */
  vbW: number;
  vbH: number;
  /** 캡션 띠를 더한 전체 높이(= SVG viewBox 높이). */
  totalH: number;
  /** `<svg width/height>` 에 그대로 찍는 출력 픽셀. 이것이 PNG 픽셀 크기다. */
  widthPx: number;
  heightPx: number;
  /** 월드 px → 출력 px 배율. 어댑터가 텍스트 좌표·크기에 곱한다. */
  scale: number;
  /** 캡션 띠 높이(0 이면 캡션 없음). */
  captionH: number;
}

export function staticSceneMetrics(opts: StaticSceneOpts): SceneMetrics {
  const def = courtDefFor(opts.mode, opts.size);
  const captionH = opts.caption ? EXPORT_LAYOUT.captionBandPx : 0;
  const totalH = def.vbH + captionH;
  const longEdge = EXPORT_LAYOUT.baseLongEdgePx * (opts.resolution ?? 2);
  const scale = longEdge / Math.max(def.vbW, totalH);
  return {
    vbW: def.vbW,
    vbH: def.vbH,
    totalH,
    widthPx: Math.round(def.vbW * scale),
    heightPx: Math.round(totalH * scale),
    scale,
    captionH,
  };
}

/** 어댑터가 캔버스에 그릴 글자 하나. **좌표는 월드 px** 이고 세로는 언제나 **중심**이다
 *  (어댑터가 `textBaseline='middle'` 로 고정한다 — 기준선을 섞으면 어긋난다).
 *
 *  `font` 는 글꼴 **선택**이지 글꼴 이름이 아니다: 등번호는 Space Grotesk(라틴 서브셋으로
 *  충분하다), 한글이 들어갈 수 있는 것은 전부 Pretendard 다. */
export interface TextPlacement {
  text: string;
  x: number;
  y: number;
  sizePx: number;
  weight: number;
  color: string;
  align: 'start' | 'middle' | 'end';
  font: 'number' | 'body';
  opacity: number;
}

export const FONT_STACKS = {
  number: "'Space Grotesk', sans-serif",
  body: "'Pretendard', sans-serif",
} as const;

/** 캔버스 `ctx.font` 문자열. 크기는 **출력 px**(월드 px × scale)이다. */
export function fontCssFor(p: TextPlacement, scale: number): string {
  return `${p.weight} ${Math.round(p.sizePx * scale * 100) / 100}px ${FONT_STACKS[p.font]}`;
}

/** SVG `text-anchor` → 캔버스 `textAlign`. LTR 만 쓰므로 start=left 로 굳힌다. */
export function canvasAlignFor(align: TextPlacement['align']): 'left' | 'center' | 'right' {
  return align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
}

/** 월드 좌표 → 출력(캔버스) 좌표. */
export function textToOutputPx(p: TextPlacement, scale: number): { x: number; y: number } {
  return { x: p.x * scale, y: p.y * scale };
}

/** 프레임 + 옵션 → 캔버스가 그릴 글자 전량.
 *
 *  **빈 메모의 플레이스홀더('메모')는 넣지 않는다.** 그건 "여기 글을 쓰세요" 라는 앱의 말이지
 *  코치가 팀에 보내려는 내용이 아니다 — 내보낸 그림에 앱의 안내문이 찍히면 그게 곧 오독이다.
 *  쪽지 자체는 그려지므로 "메모를 놓은 자리" 는 그림에 남는다. */
export function buildTextPlacements(frame: RenderFrame, opts: StaticSceneOpts): TextPlacement[] {
  const out: TextPlacement[] = [];

  // 등번호·골키퍼 'G'. 위치는 ChairChip 과 같은 식이어야 한다 — 피벗에서 centroidOffsetPx
  // 만큼 앞(§3.4 피벗 원점 규약). `pointAtLever` 가 그 식의 유일한 출처다(model/chair.ts).
  // 글자는 차체가 돌아도 **절대 회전하지 않는다**(§3.4) — 그래서 회전 정보를 싣지 않는다.
  for (const c of frame.chairs) {
    if (c.opacity <= 0) continue;
    const mark = teamMarkFor(c.def, opts.teams);
    if (mark.label.length === 0) continue;
    const p = pointAtLever({ x: c.x, y: c.y, theta: c.theta }, CHAIR.centroidOffsetPx);
    out.push({
      text: mark.label,
      x: p.x,
      y: p.y,
      sizePx: EXPORT_LAYOUT.chipLabelSizePx,
      weight: EXPORT_LAYOUT.chipLabelWeight,
      color: mark.ink,
      align: 'middle',
      font: 'number',
      opacity: c.opacity,
    });
  }

  // 메모 글자. x 오프셋 규칙은 NoteLabel.tsx 와 같다 — align 은 글의 정렬이자 **앵커 기준
  // 칩의 위치**이기도 하다(start 면 앵커가 왼쪽 끝).
  for (const n of frame.notes) {
    if (n.opacity <= 0 || n.text.length === 0) continue;
    const size = n.size ?? 14;
    const align = n.align ?? 'middle';
    const halfW = noteHalfWidth(n.text, size);
    const dx = align === 'start' ? -halfW + NOTE.chipPadXPx : align === 'end' ? halfW - NOTE.chipPadXPx : 0;
    out.push({
      text: n.text,
      x: n.x + dx,
      y: n.y,
      sizePx: size,
      weight: EXPORT_LAYOUT.noteTextWeight,
      color: safeColor(n.color, '#ffffff'),
      align,
      font: 'body',
      opacity: n.opacity,
    });
  }

  const cap = opts.caption;
  if (cap) {
    const def = courtDefFor(opts.mode, opts.size);
    const ink = (opts.background ?? 'white') === 'white' ? CAPTION_INK_ON_WHITE : CAPTION_INK_ON_DARK;
    out.push({
      text: cap.title,
      x: EXPORT_LAYOUT.captionPadXPx,
      y: def.vbH + EXPORT_LAYOUT.captionTitleCy,
      sizePx: EXPORT_LAYOUT.captionTitleSizePx,
      weight: 700,
      color: ink.title,
      align: 'start',
      font: 'body',
      opacity: 1,
    });
    out.push({
      text: captionSubText(cap),
      x: EXPORT_LAYOUT.captionPadXPx,
      y: def.vbH + EXPORT_LAYOUT.captionSubCy,
      sizePx: EXPORT_LAYOUT.captionSubSizePx,
      weight: 500,
      color: ink.sub,
      align: 'start',
      font: 'body',
      opacity: 1,
    });
  }

  return out;
}

/** '3/7 · 왼쪽 전환' — 스텝 이름이 비어 있으면 번호만. */
export function captionSubText(cap: SceneCaption): string {
  const no = `${cap.stepIndex + 1}/${cap.stepCount}`;
  return cap.stepName.length > 0 ? `${no} · ${cap.stepName}` : no;
}

/** 쪽지 칩 폭의 절반. */
export function noteHalfWidth(text: string, size: number): number {
  return noteChipWidthPx(text, size) / 2;
}
