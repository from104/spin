// §6.x 렌더 경로 레지스트리의 **집행자**. `renderPaths.ts` 의 표가 문서가 아니라 계약이 되게 한다.
//
// 이 파일이 막으려는 것은 딱 하나다: **요소를 새로 만든 사람이 경로 하나를 안 들르는 것.**
// 2026-08-17~27 사이에만 네 번 났고(renderPaths.ts 머리말), 네 번 다 사람이 성실하지 않아서가
// 아니라 *알려 줄 자리가 없어서* 났다.
//
// ── 세 겹으로 잡는다 ────────────────────────────────────────────────────────────────────
//   ① **경로 발견**: 소스 트리를 훑어 "코트를 그리는 파일" 을 찾고, 레지스트리의 경로 목록과
//      대조한다. 6번째 경로가 등록 없이 생기면 여기서 걸린다(손으로 적은 목록은 이걸 못 한다).
//   ② **그린다는 칸의 증거**: `draws:true` 인 칸은 그 경로 소스에 실제 흔적이 있어야 한다.
//      표만 고치고 코드를 안 고치면 걸린다.
//   ③ **안 그린다는 칸의 사유**: `draws:false` 는 사유 문자열이 비면 안 된다. 부재가 판단으로
//      남고, 다음 사람이 그 판단을 읽고 뒤집을 수 있다.
//
// ⚠️ ②는 **문자열 증거**라 완벽하지 않다(이름을 바꾸면 놓친다). 그래서 모양의 동일성은 여전히
//    `features/export/courtLines.contract.test.ts` 가 따로 잰다 — 이 파일은 *"들렀는가"*, 그쪽은
//    *"같게 그렸는가"* 다. 둘 중 하나만으로는 부족하다는 것이 네 번의 사고가 남긴 교훈이다.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RENDER_PATHS, RENDER_PATH_IDS, SCENE_ELEMENT_IDS, pathDraws, pathsDrawing } from './renderPaths.ts';
import type { RenderPathId, SceneElementId } from './renderPaths.ts';

/** 각 경로의 **진입 파일**. 요소의 흔적을 여기(그리고 아래 `alsoRead`)에서 찾는다. */
const PATH_FILES: Record<RenderPathId, { entry: string; alsoRead?: string[] }> = {
  editor: { entry: 'src/render/CourtStage.tsx', alsoRead: ['src/render/ObjectLayer.tsx', 'src/features/editor/EditorStage.tsx'] },
  present: { entry: 'src/features/present/PresentStage.tsx', alsoRead: ['src/features/present/PresentObjects.tsx'] },
  // PNG 는 파일 셋이 한 경로다: 도형은 `buildStaticSvg`, **글자는 `staticSceneLayout`** 이
  // 배치하고 어댑터(rasterize.ts)가 캔버스에 굽는다(★[A-9]). 격자 번호가 그쪽에 있으므로
  // 여기 안 적으면 증거를 못 찾는다 — 2026-09-06.
  png: { entry: 'src/features/export/buildStaticSvg.ts', alsoRead: ['src/features/export/staticSceneLayout.ts'] },
  print: { entry: 'src/features/print/PrintCourt.tsx' },
  thumbnail: { entry: 'src/render/CourtThumbnail.tsx' },
};

/** 그 요소가 그려졌다면 소스에 반드시 남는 흔적. 하나라도 있으면 통과(경로마다 표현이 다르다 —
 *  React 컴포넌트를 쓰기도 하고 문자열을 굽기도 한다). */
const EVIDENCE: Record<SceneElementId, readonly string[]> = {
  courtLines: ['CourtSurface', 'courtLinesMarkup'],
  goalPosts: ['goalPosts', 'goalPostsMarkup', 'GoalPost', 'CourtSurface'],
  grid: ['GridOverlay', 'gridMarkup'],
  gridLabels: ['showGridLabels', 'showLabels'],
  ruleZones: ['RuleZones', 'ruleZonesMarkup'],
  ballRings: ['RuleOverlay', 'ruleMarkup'],
  ownerArrow: ['RuleOverlay', 'ruleMarkup', 'ownerArrow'],
  sideFlags: ['SideMarks', 'sideMarksMarkup', 'sideFlagGroups'],
  chairs: ['ChairChip', 'chairMarkup', 'data-print-chair', 'ThumbSpec', 'chairs'],
  balls: ['BallDot', 'ballMarkup', 'balls'],
  cones: ['ConeMark', 'coneMarkup', 'cones'],
  shapes: ['ShapeLayer', 'ShapeMark', 'shapesMarkup'], // 2026-09-06 — 층(ShapeLayer)은 썸네일만, 나머지 넷은 한 장씩(ShapeMark)
  arrows: ['ArrowPath', 'arrowMarkup', 'arrowPath', 'PresentArrowMark'],
  strokes: ['StrokePath', 'strokeMarkup', 'strokePath', 'PresentStrokeMark'],
  notes: ['NoteLabel', 'noteMarkup', 'noteChip', 'PresentNoteMark'],
  // 상태 표시 둘(2026-09-06). 무시는 프레임 opacity 로 오므로 정적 경로에는 `IGNORED_OPACITY`
  // 를 부르는 줄이 없다 — 대신 그 값을 실어 오는 `staticFrameOf`/`interpolateSteps` 를 흔적으로
  // 본다(인쇄는 `chairOpacity`, 시연·PNG 는 프레임의 opacity 를 그대로 쓴다).
  ignoredDim: ['IGNORED_OPACITY', 'chairOpacity', 'opacityWriter', 'attrOpacity'],
  lockTint: ['LockTint', 'locked'],
};

const sourceOf = (path: RenderPathId): string =>
  [PATH_FILES[path].entry, ...(PATH_FILES[path].alsoRead ?? [])].map((f) => readFileSync(f, 'utf-8')).join('\n');

describe('렌더 경로 레지스트리 — 표가 곧 계약이다', () => {
  it('모든 경로 × 모든 요소가 빠짐없이 선언돼 있다', () => {
    // Record 라 컴파일이 이미 강제하지만, 런타임에서도 한 번 확인한다 — 타입만 맞추고 값을
    // 안 채우는 우회(as any 등)가 들어오면 여기서 걸린다.
    for (const p of RENDER_PATH_IDS) {
      for (const el of SCENE_ELEMENT_IDS) {
        expect(RENDER_PATHS[p][el], `${p} × ${el}`).toBeDefined();
      }
    }
  });

  it("'안 그린다' 는 반드시 사유를 단다 — 부재가 의견이 아니라 기록이 되게", () => {
    for (const p of RENDER_PATH_IDS) {
      for (const el of SCENE_ELEMENT_IDS) {
        const s = RENDER_PATHS[p][el];
        if (s.draws) continue;
        expect(s.why.length, `${p} × ${el} 의 사유가 비었다`).toBeGreaterThan(10);
      }
    }
  });
});

describe('② 표가 그린다는 것은 코드에도 있어야 한다', () => {
  const cases = RENDER_PATH_IDS.flatMap((p) => SCENE_ELEMENT_IDS.filter((el) => pathDraws(p, el)).map((el) => [p, el] as const));

  it.each(cases)('%s 가 %s 를 실제로 그린다', (p, el) => {
    const src = sourceOf(p);
    const hit = EVIDENCE[el].some((token) => src.includes(token));
    expect(hit, `${p} 소스에 ${el} 의 흔적(${EVIDENCE[el].join(' | ')})이 없다`).toBe(true);
  });
});

describe('① 경로 발견 — 등록 없이 생긴 렌더 경로를 잡는다', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  }

  it('`CourtSurface` 를 세우는 프로덕션 파일은 전부 레지스트리에 있다', () => {
    // 코트를 그리는 화면의 정의를 "CourtSurface 를 마운트한다" 로 잡는다 — PNG 는 그 컴포넌트를
    // 쓸 수 없어(번들 바이트, buildStaticSvg 머리말) 손이식하므로 예외로 둔다.
    const found = walk('src')
      .filter((f) => /<CourtSurface/.test(readFileSync(f, 'utf-8')))
      .sort();
    const registered = RENDER_PATH_IDS.flatMap((p) => [PATH_FILES[p].entry, ...(PATH_FILES[p].alsoRead ?? [])]);
    for (const f of found) {
      expect(registered, `${f} 가 코트를 그리는데 renderPaths 레지스트리에 없다`).toContain(f);
    }
  });
});

describe('③ 이번 사고가 다시 나는지 — 인쇄가 여섯 가지를 그린다', () => {
  // 2026-08-27 기현 신고: *"인쇄 시 원, 공 가로지르는 화살표, 코트 구역 나눔, 구역 번호 안 나옴."*
  // 레지스트리가 이미 그것을 요구하므로 위 ②가 잡지만, **신고된 항목 그 자체**를 이름으로
  // 남겨 둔다 — 나중에 이 줄이 빨개지면 "그때 그 문제" 라는 것이 바로 읽힌다.
  it.each(['grid', 'gridLabels', 'ballRings', 'ownerArrow'] as const)('인쇄가 %s 를 그린다', (el) => {
    expect(pathDraws('print', el)).toBe(true);
  });

  it('규칙 표시(링·소유 화살표·존)를 그리는 경로는 정적 렌더도 포함한다', () => {
    // 화면 둘만이면 종이·그림이 또 빠진 것이다.
    expect(pathsDrawing('ballRings')).toEqual(['editor', 'present', 'png', 'print']);
    expect(pathsDrawing('ownerArrow')).toEqual(['editor', 'present', 'png', 'print']);
  });

  it('썸네일은 허용 목록대로 다섯 + 코트만 그린다 (2026-08-27 지시 + 2026-09-03 획)', () => {
    // 목록이 거부가 아니라 **허용**이라는 것이 이 줄의 요점이다 — 새 요소는 여기를 고치지
    // 않는 한 썸네일에 자동으로 실리지 않는다(그 자동 승선이 44 px 칩을 뭉갠다).
    // ⚠️ 2026-09-06 — 목록에서 `goalPosts` 가 빠졌다. 표가 그린다고 적고 있었을 뿐 실제로는
    //    한 번도 안 그렸다(COURT_LINE_WEIGHTS.thumb 에 spotR 이 없다) — 표를 사실로 고쳤다.
    const drawn = SCENE_ELEMENT_IDS.filter((el) => pathDraws('thumbnail', el));
    expect(drawn).toEqual(['courtLines', 'chairs', 'balls', 'shapes', 'strokes', 'arrows']);
  });
});
