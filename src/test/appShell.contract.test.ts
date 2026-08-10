// §6.4 앱 셸 가둠 계약 — 웹앱을 창 안에 붙잡아 태블릿 앱처럼 쓰게 하는 설정들.
//
// 왜 텍스트 계약 테스트인가: 여기 걸린 것들은 **CSS 한 줄·메타 한 줄**이라 리팩터링 중에
// 조용히 사라지기 쉽고, 사라져도 단위 테스트는 전부 초록불이다(jsdom 은 레이아웃을 하지
// 않으므로 100vh 든 100dvh 든 아무 차이가 없다). 실기에서만 드러나는 종류 —
// "주소창이 보이는 동안 하단 바가 화면 밖으로 내려간다" 같은 것 — 이라 여기서 못박는다.
// viteConfig.test.ts 와 같은 방식이다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');
const indexHtml = read('index.html');
const shellCss = read('src/styles/appShell.css');
const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, unknown>;

describe('뷰포트 — 창 크기에 가둔다', () => {
  it('페이지 자체가 스크롤되지 않는다', () => {
    // 이게 풀리면 코트가 조금만 커져도 하단 바(트랜스포트·전술판 바·속성 시트)가 밀려난다.
    expect(shellCss).toMatch(/html,\s*body,\s*#root\s*\{[^}]*overflow:\s*hidden/s);
  });

  it('당겨서 새로고침·고무줄 반동을 끈다', () => {
    expect(shellCss).toMatch(/overscroll-behavior:\s*none/);
  });

  it('높이를 dvh 로 잡는다 — iOS 의 100vh 는 주소창이 가린 영역까지 포함한다', () => {
    // vh 폴백이 dvh 보다 **앞에** 와야 한다(모르는 브라우저가 뒷줄을 버리고 앞줄을 쓴다).
    const html = shellCss.match(/html\s*\{([^}]*)\}/g)?.join('\n') ?? '';
    const vhAt = html.indexOf('height: 100vh');
    const dvhAt = html.indexOf('height: 100dvh');
    expect(vhAt, 'vh 폴백이 없다').toBeGreaterThanOrEqual(0);
    expect(dvhAt, 'dvh 선언이 없다').toBeGreaterThanOrEqual(0);
    expect(dvhAt).toBeGreaterThan(vhAt);
  });

  it('앱 셸이 100vh 를 직접 쓰지 않는다', () => {
    // AppShell 이 다시 100vh 를 잡으면 위 dvh 처리가 통째로 무의미해진다.
    expect(read('src/app/AppShell.tsx')).not.toContain('100vh');
  });

  it('더블탭 확대를 끄되 코트의 핀치는 살린다', () => {
    expect(shellCss).toMatch(/body\s*\{[^}]*touch-action:\s*manipulation/s);
    // 코트는 브라우저 제스처를 통째로 가져가야 핀치가 코트 줌이 된다.
    expect(read('src/render/CourtStage.tsx')).toContain("touchAction: 'none'");
  });
});

describe('안전 영역 — 노치·홈 인디케이터', () => {
  it('viewport-fit=cover 와 safe-area 여백은 한 쌍이다', () => {
    // cover 만 켜고 여백을 안 주면 UI 가 노치·홈 인디케이터에 먹힌다.
    expect(indexHtml).toContain('viewport-fit=cover');
    expect(shellCss).toMatch(/#root\s*\{[^}]*env\(safe-area-inset-/s);
  });

  it('상태바 뒤까지 그리는 iOS 설정도 같은 쌍에 속한다', () => {
    expect(indexHtml).toContain('apple-mobile-web-app-status-bar-style');
  });
});

describe('입력은 여전히 선택·복사가 된다', () => {
  it('전역 user-select:none 에 입력 요소 예외가 있다', () => {
    // 예외가 없으면 인스펙터의 제목·시간 입력에서 텍스트를 못 고른다.
    expect(shellCss).toMatch(/body\s*\{[^}]*user-select:\s*none/s);
    expect(shellCss).toMatch(/input,\s*\n?\s*textarea[^{]*\{[^}]*user-select:\s*text/s);
  });
});

describe('PWA — 홈 화면에 추가하면 전체화면 (태블릿 앱 포팅 전까지의 자리)', () => {
  it('standalone 으로 뜬다', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('회전을 잠그지 않는다 — 가로·세로 둘 다 쓰는 앱이다(§6.4)', () => {
    // 'portrait'/'landscape' 로 잠그면 코트 회전 원칙 자체가 무의미해진다.
    expect(manifest.orientation).toBe('any');
  });

  it('아이콘이 실제로 존재하고 제 크기다', () => {
    const icons = manifest.icons as Array<{ src: string; sizes: string }>;
    expect(icons.length).toBeGreaterThan(0);
    for (const i of icons) {
      const buf = readFileSync(resolve(process.cwd(), 'public', i.src.replace(/^\//, '')));
      // PNG 헤더의 IHDR 에서 실제 픽셀 크기를 읽어 sizes 와 대조한다(파일만 있고 크기가
      // 다르면 홈 화면 아이콘이 뭉개진다).
      expect(buf.subarray(1, 4).toString()).toBe('PNG');
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect(`${w}x${h}`).toBe(i.sizes);
    }
  });

  it('iOS 홈 화면 아이콘이 따로 걸려 있다 — iOS 는 manifest 아이콘을 쓰지 않는다', () => {
    expect(indexHtml).toContain('rel="apple-touch-icon"');
    const buf = readFileSync(resolve(process.cwd(), 'public/apple-touch-icon.png'));
    expect(buf.readUInt32BE(16)).toBe(180);
  });

  it('manifest 가 index.html 에 연결돼 있다', () => {
    expect(indexHtml).toMatch(/rel="manifest"\s+href="\/manifest\.webmanifest"/);
  });
});

describe('세로 축 플렉스 사슬 — 코트가 아래 도구를 밀어내지 않는다 (§6.4)', () => {
  // jsdom 은 레이아웃을 하지 않으므로 이 결함은 단위 테스트로 절대 잡히지 않는다.
  // 실제 증상: 세로에서 코트가 회전하면 아래 도구·속성이 화면 밖으로 밀려나 안 보인다.
  const workspace = read('src/features/editor/EditorWorkspace.tsx');

  it('코트 컬럼에 minHeight:0 이 있다', () => {
    // 세로 배치에서 이 div 는 수직 주축의 플렉스 항목이다. 기본값 min-height:auto 면
    // 안쪽 <svg> 가 viewBox 의 고유 종횡비로 높이를 정해버린다(회전 시 500×800 = 세로로 김).
    const courtColumn = workspace
      .split('\n')
      .find((l) => l.includes("flexDirection: 'column'") && l.includes("background: 'var(--panel-2)'"));
    expect(courtColumn, '코트 컬럼 div 를 찾지 못했다 — 선택자가 낡았다').toBeDefined();
    expect(courtColumn!).toContain('minHeight: 0');
    // minWidth:0 은 가로 배치용이라 이걸 대신하지 못한다. 둘 다 있어야 한다.
    expect(courtColumn!).toContain('minWidth: 0');
  });

  it('세로 배치의 바깥 main 에도 minHeight:0 이 있다', () => {
    const main = workspace.split('\n').find((l) => l.includes('flexDirection: portrait'));
    expect(main, 'main 의 방향 전환 스타일을 찾지 못했다').toBeDefined();
    expect(main!).toContain('minHeight: 0');
  });

  it('스테이지 영역도 줄어들 수 있다', () => {
    // 속성 **순서**가 아니라 있고 없음을 본다 — 순서로 걸면 무해한 정렬 변경에도 빨간불이 뜬다.
    const stage = workspace.split('\n').find((l) => l.includes("padding: '20px 24px'"));
    expect(stage, '스테이지 영역 div 를 찾지 못했다 — 선택자가 낡았다').toBeDefined();
    for (const prop of ['flex: 1', 'minHeight: 0', 'minWidth: 0', "position: 'relative'"]) {
      expect(stage!, `스테이지 영역에 ${prop} 이 없다`).toContain(prop);
    }
  });
});

// 2026-08-11 기현 결정: 도구·개체를 **판 오른쪽에 몰고**, 트레이가 별도 패널이 아니라
// "판의 오른쪽 일부"로 보이게 한다. 실제 전술판에서 말이 놓여 있는 가장자리 연출이다.
// jsdom 은 레이아웃도 색도 계산하지 않으므로 이 결정은 여기서만 지킬 수 있다.
describe('개체 트레이는 판의 일부다 (§6.10 재편)', () => {
  const workspace = read('src/features/editor/EditorWorkspace.tsx');
  const rail = read('src/features/editor/ToolRail.tsx');
  const lines = workspace.split('\n');

  it('트레이는 한 곳에서만 렌더된다', () => {
    // 예전에는 가로/세로에서 각각 렌더했다. 두 번 렌더하면 방향 전환 때 언마운트–재마운트가
    // 일어나 트레이의 펼침 상태(콘 색·선수 목록)가 날아간다.
    const hits = lines.filter((l) => l.trim() === '{toolRail}');
    expect(hits).toHaveLength(1);
  });

  it('트레이가 판(--panel-2 패널) **안**에 있다', () => {
    const panelAt = lines.findIndex((l) => l.includes("flexDirection: 'column'") && l.includes("background: 'var(--panel-2)'"));
    const trayAt = lines.findIndex((l) => l.trim() === '{toolRail}');
    const stageAt = lines.findIndex((l) => l.includes("padding: '20px 24px'"));
    expect(panelAt).toBeGreaterThanOrEqual(0);
    expect(trayAt, '트레이가 판 바깥으로 나갔다 — 별도 패널처럼 보인다').toBeGreaterThan(panelAt);
    expect(trayAt, '트레이가 코트보다 앞에 있다 — 판 오른쪽이 아니다').toBeGreaterThan(stageAt);
  });

  it('트레이 배경이 판과 같은 색이다 — 패널 경계가 보이면 안 된다', () => {
    const base = rail.match(/const RAIL_BASE = \{[^}]*\}/s)?.[0] ?? '';
    expect(base).toContain("background: 'var(--panel-2)'");
    expect(base, '별도 패널 색을 쓰면 판에서 떨어져 보인다').not.toContain("background: 'var(--panel)'");
  });

  it('플라이아웃이 코트 쪽(왼쪽)으로 펴진다', () => {
    // 트레이가 오른쪽으로 옮겨졌으므로 `left:'100%'` 를 그대로 두면 콘 색·선수 목록이
    // 화면 밖으로 나가 통째로 잘린다. 실기에서만 드러나는 종류다.
    expect(rail).toContain("right: '100%'");
    expect(rail, '왼쪽 레일 시절의 오른쪽 펼침이 남아 있다').not.toContain("left: '100%'");
  });
});
