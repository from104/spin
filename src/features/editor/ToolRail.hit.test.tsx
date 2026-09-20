// 2.4 — `--hit` 실배선 + 트레이 93/117 (§5.4).
//
// 두 층을 따로 본다:
//   ② **DOM 배선** — 화면의 인라인 style 이 정말 그 식의 calc 문자열을 쓰는가. 문자열을
//      소스에서 import 하지 않고 **리터럴로 다시 적는다** — 소스 상수를 읽어 비교하면 식이
//      틀려도 테스트가 따라 움직여 아무것도 못 잡는다(자기 사본 문제).
//   ③ **축척 불변** — 1024×600 에서 --hit 44↔56 전환이 pxPerUnit 을 한 눈금도 못 움직인다.
//      세로가 제약이라 트레이 24px 는 폭 여유(§5.4 '남는 폭')에서 나오기 때문이다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ToolRail, type ChairSlot } from './ToolRail.tsx';
import { trayRailWidthPx } from './trayMetrics.ts';
import { CHROME_ROWS, courtBoxPx, courtScale } from '../../app/chromeBudget.ts';
import type { ChromeState } from '../../app/chromeBudget.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { BALL, CONE } from '../../core/constants.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

// ToolRail 이 useT()/useLocale()(→ SettingsProvider)을 쓴다(C7) — 이 파일 전체를 감싼다.
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: SettingsProvider });
import type { ChairId } from '../../core/ids.ts';

// ── ② DOM 배선 ──────────────────────────────────────────────────────────────

const SLOTS: ChairSlot[] = [
  { id: 'ch_hit_a' as ChairId, number: '2', color: '#d93a3a', ink: '#fff', placed: false },
  { id: 'ch_hit_b' as ChairId, number: '5', color: '#d93a3a', ink: '#fff', placed: true },
];

function Rail({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const [pending, setPending] = useState<ChairId | null>(null);
  return (
    <ToolRail
      tool="select"
      onSelectTool={() => {}}
      coneSlot={0}
      onConeSlotChange={() => {}}
      ballCount={0}
      ballMax={BALL.maxCount}
      coneCounts={[0, 0]}
      coneMax={CONE.maxCountPerColor}
      chairSlots={SLOTS}
      pendingPlayerId={pending}
      onArmPlayer={setPending}
      courtLabel="풀 코트"
      orientation={orientation}
    />
  );
}

// 픽셀 식과 같은 식의 calc — **리터럴이다.** 식을 바꾸면 ①과 여기가 함께 빨간불이 나야 맞다.
const ROW_MAX_CSS = 'calc(var(--hit) * 2 + 5px)';
const ROW_CAP_CSS = 'calc(var(--hit) * 5 + 20px)';

describe('트레이 DOM — 칩·폭이 --hit 파생 calc 로 걸려 있다', () => {
  // ── 2026-08-14 P3: 이 it 을 **뒤집었다** (설계서 §6 "깨질 테스트 판정") ────────────────────
  // 옛 단언은 *"세로 트레이의 폭이 칩 두 줄 식이다"* — `width` 와 `minWidth` 둘 다 93 식이었다.
  // 유동 트레이에서는 `width` 못박음이 정확히 **2열을 강제하던 장본인**이라 삭제했고, 그 자리에
  // `=== ''` 대조군을 세운다. `minWidth` 는 **그대로 유지**한다 — 뜻이 "폭" 에서 "칩 두 줄
  // **최소**폭" 으로 바뀌었을 뿐 값은 같고, 폭 제약 기기(1280·1920 핀)에서 트레이가 멈추는
  // 자리가 여전히 그것이다. 새로 못박는 것은 상한(5열)과 `flex:'1 1 0'` 이다.
  it('세로 트레이의 폭은 구간이다 — 하한 2열, 상한 5열, 못박음 없음', () => {
    render(<Rail />);
    const nav = screen.getByRole('navigation', { name: '도구' });
    // 대조군: 폭을 못박으면 남는 폭이 트레이로 흘러들지 못한다 — P3 의 본체가 이 빈 문자열이다.
    expect(nav.style.width, '폭 못박음이 되살아났다 — 트레이가 다시 2열에 갇힌다').toBe('');
    expect(nav.style.minWidth).toBe(ROW_MAX_CSS);
    expect(nav.style.maxWidth).toBe(ROW_CAP_CSS);
  });

  it("트레이는 flex base 가 0 이다 — '1 1 auto' 면 코트까지 줄어든다(§4.1 함정 1)", () => {
    // base 가 max-content 면 라인이 넘쳐 flex-shrink 가 **코트 칸**에도 걸린다.
    // ⚠️ 값이 '1 1 0px' 인 것은 jsdom 때문이다: cssstyle 이 단위 없는 `0` 을 flex 축약형에서
    //    거부해 선언을 통째로 버린다(2026-08-14 프로브 실측 — style 속성에 아무것도 안 남았다).
    //    브라우저에서 `0` 과 `0px` 은 같다. `0%` 로 적으면 안 된다 — 주축이 미확정인
    //    shrink-to-fit 컨테이너에서 백분율 base 는 content 로 되돌아가 함정 1 이 되살아난다.
    render(<Rail />);
    expect(screen.getByRole('navigation', { name: '도구' }).style.flex).toBe('1 1 0px');
  });
});

// 2026-08-18 — 여기 있던 ViewControls·TransportBar·BoardBar 의 --hit 계약 검증이 컴포넌트와
// 함께 사라졌다(기현님: "결과적으로 하단에는 노트 빼고 다 삭제" · "속성 버튼 및 그 안의 내용
// 폐기"). 재생·배속의 후계 계약(--hit 파생)은 StepSidebar.test.tsx 의 재생 컨트롤 절이 잇는다.
// OLD_STAGE_CONTROL_NAMES 의 7개 중 [속성]·[도움말]·격자·골 지역은 기능 바(FunctionBar)가
// 맡는다 — 그쪽 상주는 FunctionBar.items.test.tsx 가 못박는다.

// ── ③ 축척 불변 — 완료 판정 "1024×600 에서 --hit 44↔56 전환에 pxPerUnit 변화 0" ──

// ⚠️ 2026-09-18 (PLAN-UI-SCALE 결정 4) — **뷰포트가 1024×600 에서 1365×800 으로 올라갔다.**
// 가로면 레일(84)이 항상 서게 되면서 1024×600 @100% 는 트레이가 하한(93)에 붙어 «남는 폭 172px»
// 이라는 이 불변식의 전제가 사라졌다. 전제가 사라진 자리에서 불변식을 우기는 대신, 그 전제가
// 성립하는 자리로 옮긴다: 1365×800 은 **물리 1024×600 기기에서 UI 배율 75%** 일 때의 레이아웃
// 크기다(1024/0.75 = 1365, 600/0.75 = 800). 기현님 결정 — *"그대로 간다, 배율로 갚는다"*.
// 아래 마지막 it 이 «100% 에서는 깨진다» 는 사실 자체를 못박는다 — 잃은 것을 숨기지 않는다.
describe('1365×800 (물리 1024×600 @배율 75%) — --hit 전환이 코트 축척을 건드리지 않는다', () => {
  const narrowState: ChromeState = { narrow: true, landscape: true, inspector: 'hidden' };
  const VIEW = { w: 1365, h: 800 };
  // 예산표의 narrow 93 이 hit=44 의 트레이다. 56 이면 그 차이(24px)만큼 폭이 더 빠진다 —
  // 직접 min 을 적지 않는다(2.3 F7: 표 13 it 이 그 한 줄에 걸려 있었다).
  const extra = trayRailWidthPx(56) - trayRailWidthPx(44);

  it('예산표 트레이 행이 hit=44 식과 같다 — 이 대조가 어긋나면 아래 계산이 헛짚는다', () => {
    const row = CHROME_ROWS.find((r) => r.id === 'toolRail')!;
    expect(trayRailWidthPx(44)).toBe(row.narrow);
    expect(extra).toBe(24);
  });

  it.each(['full', 'half', 'flat'] as const)('%s 코트: pxPerUnit 변화가 정확히 0 이다', (mode) => {
    const at44 = courtBoxPx(VIEW, narrowState);
    const at56 = { w: at44.w - extra, h: at44.h };
    const s44 = courtScale(mode, at44);
    const s56 = courtScale(mode, at56);
    expect(s56.pxPerUnit).toBe(s44.pxPerUnit);
    // 이유까지 못박는다: 폭을 24 뺏겨도 여전히 **세로가 제약**이라(§5.4 '남는 폭 172px')
    // 축척이 통째로 세로에서 나온다 — 돌지 않았고, 값이 정확히 h/vbH 다.
    expect(s56.rot).toBe(0);
    expect(s56.pxPerUnit).toBe(at56.h / COURT_DEFS[mode].vbH);
  });

  it('대조군: 폭이 제약인 상자였다면 24px 만큼 실제로 줄었다', () => {
    // "변화 0" 단언이 courtScale 고장(항상 같은 값)으로도 통과하지 않는지 찌른다.
    // (400 이 아니라 600 인 이유: 상자가 세로로 길어지면 rotForFit 이 돌려서 도로 세로 제약이
    //  된다 — 폭 제약을 유지하려면 안 도는 납작한 상자라야 한다.)
    const tight = { w: 600, h: 468 };
    const tighter = { w: 600 - extra, h: 468 };
    expect(courtScale('full', tighter).pxPerUnit).toBeLessThan(courtScale('full', tight).pxPerUnit);
  });
});

// PLAN-UI-SCALE 결정 4 의 **대가를 못박는다.** 위 불변식이 물리 1024×600 의 배율 100% 에서는
// 깨진다 — 레일 84 가 돌아오며 트레이가 하한(93)에 붙어, --hit 을 56 으로 올리면 그 24px 이
// 트레이가 아니라 **코트**에서 나온다. 이 테스트가 초록인 동안은 "배율 75% 로 갚는다" 가 빈말이
// 아니라 측정된 사실이고, 언젠가 이 두 값이 같아지면(= 깨짐이 사라지면) 위 describe 의 뷰포트를
// 1024×600 으로 되돌려도 된다는 신호다.
describe('물리 1024×600 @배율 100% — 잃은 것', () => {
  const narrowState: ChromeState = { narrow: true, landscape: true, inspector: 'hidden' };
  const extra = trayRailWidthPx(56) - trayRailWidthPx(44);

  it('--hit 56 이 코트 축척을 실제로 깎는다 — 트레이가 하한이라 흡수하지 못한다', () => {
    const at44 = courtBoxPx({ w: 1024, h: 600 }, narrowState);
    const at56 = { w: at44.w - extra, h: at44.h };
    expect(courtScale('full', at56).pxPerUnit).toBeLessThan(courtScale('full', at44).pxPerUnit);
  });
});

// 2026-09-20 iPad mini 세로 실기(에뮬레이터) — 자동이 정한 배율에서 개체 벤치가 237px 넘쳤다.
// 원인은 배율이 아니라 **스크롤바 9px** 이었다: 기둥은 자기 최소폭 93(= 칩 2열)에 서 있는데
// 클래식 스크롤바가 9를 먹어 내용 폭이 84 로 떨어지고, 84 에는 칩이 **1열**만 들어간다.
// 1열이면 칩 8개가 4줄 → 8줄이 되어 내용이 357 → 555 로 커지고, 커졌으니 스크롤바가 계속
// 선다 — 배율을 올려도 안 풀리는 **자기 유지 고리**였다(실측: 2·1.75·1.5·1.25 전부 84).
//
// jsdom 은 스크롤바도 레이아웃도 없어 이 고리를 재현하지 못한다. 그래서 «내용 폭을 도로
// 넓히는 선언이 붙어 있는가» 를 본다 — 그 선언이 사라지면 화면에서만 도지고, 도진 모습은
// «칩이 한 줄로 길게 늘어선다» 라 결함으로 안 보인다.
describe('개체 벤치 — 스크롤바가 칩 열을 먹지 않는다', () => {
  const src = readFileSync(resolve(__dirname, 'ToolRail.tsx'), 'utf8');

  it('벤치가 스크롤바를 지운다 — 인라인 scrollbarWidth 와 웹킷용 클래스 둘 다', () => {
    expect(src).toContain("scrollbarWidth: 'none' as const");
    // 인라인 style 로는 ::-webkit-scrollbar 를 못 쓴다 — 크로미움(= 안드로이드 WebView)이
    // 받는 것은 이쪽이라, 한 쪽만 있으면 정작 터지는 곳에서 안 듣는다.
    expect(src).toContain('className="spin-nav-seg"');
  });

  it('그 클래스의 CSS 규칙이 실제로 있다', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/appShell.css'), 'utf8');
    expect(css).toMatch(/\.spin-nav-seg::-webkit-scrollbar\s*\{\s*display:\s*none;?\s*\}/);
  });
});
