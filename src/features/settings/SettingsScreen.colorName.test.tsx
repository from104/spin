// 7차 검증 — 팀 색 이름의 **출처가 하나인가** (경계 밖 발견의 처리, 2026-08-14).
//
// ── 무엇이 문제였나 ─────────────────────────────────────────────────────────────────
// P1-b 라운드가 `core/colors.ts` 에 `TEAM_COLOR_NAMES` 를 세워 인스펙터 스와치의 `aria-label`
// 이 hex(`#d93a3a`)를 낱글자로 읽던 결함을 고쳤다. 그런데 **설정 화면에는 같은 표가 로컬로 한 벌
// 더 있었다**(SettingsScreen.tsx:31 의 `COLOR_NAMES`). 값이 같아 눈으로는 아무 차이가 없어
// 5차·6차 두 라운드에서 보고만 되고 *"내 소유 파일이 아니라 안 고쳤다"* 로 남았다.
//
// 값이 같은데도 결함인 이유는 **타입**이다:
//   · `TEAM_COLOR_NAMES` 의 키 = `(typeof TEAM_COLOR_CHOICES)[number]` 유니언 → 선택지에 색을
//     추가하면 **tsc 가 이름을 먼저 요구한다.**
//   · 옛 로컬 맵 = `Record<string, string>` + `?? c` 폴백 → **아무 색이 빠져도 tsc 가 침묵하고**
//     화면은 조용히 hex 로 되돌아간다.
// 즉 팔레트에 색을 한 칸 더하는 날, 인스펙터는 한국어 이름을 얻는데 설정 화면 스와치만
// 스크린리더가 "샵 씨 팔 일 공 이 이 이" 를 읽는 상태가 된다. 그 갈라짐을 여기서 막는다.
//
// ⚠️ 아래 ②는 **소스 계약**이다. jsdom 은 "지금 화면이 맞다" 만 말할 수 있고 "다음에 색을
//    추가해도 맞다" 는 말하지 못한다 — 오늘 두 맵의 값이 같기 때문이다. 그래서 ①(렌더된 이름)
//    만으로는 로컬 맵을 되돌려도 **빨간불이 안 난다.** 두 절이 함께 있어야 한다.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsScreen } from './SettingsScreen.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { TEAM_COLOR_CHOICES, TEAM_COLOR_NAMES } from '../../core/colors.ts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <LibraryProvider>
      <ToastProvider>{children}</ToastProvider>
    </LibraryProvider>
  </SettingsProvider>
);

const SRC = resolve(__dirname, 'SettingsScreen.tsx');
/** 주석을 걷어낸 코드만. 옛 결정 기록(주석)이 계약을 깨뜨리게 하지 않기 위해서다 —
 *  useStageRot.test.ts 의 `codeOf` 와 같은 관례. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n');
}

describe('① 설정 화면 스와치는 hex 가 아니라 한국어 이름을 읽어 준다', () => {
  it('네 스와치의 접근성 이름이 전부 "팀 색상: <한국어>" 다', () => {
    render(<SettingsScreen />, { wrapper });
    for (const c of TEAM_COLOR_CHOICES) {
      const name = TEAM_COLOR_NAMES[c];
      // 같은 이름의 라디오가 우리 팀/상대 팀 두 벌 있다 — 둘 다 있어야 한다.
      const found = screen.getAllByRole('radio', { name: `팀 색상: ${name}` });
      expect(found.length, `${c}(${name}) 스와치를 못 찾았다`).toBeGreaterThanOrEqual(2);
    }
  });

  it('어떤 스와치의 이름에도 hex 가 새지 않는다 (대조군 — 이름을 실제로 읽고 있다는 증거)', () => {
    render(<SettingsScreen />, { wrapper });
    const names = screen.getAllByRole('radio').map((el) => el.getAttribute('aria-label') ?? '');
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => n.includes('#'))).toEqual([]);
  });
});

describe('② 소스 계약 — 이름표는 core/colors.ts 한 곳에서만 온다', () => {
  it('SettingsScreen 은 TEAM_COLOR_NAMES 를 임포트한다', () => {
    expect(codeOf(SRC)).toMatch(/import\s*\{[^}]*\bTEAM_COLOR_NAMES\b[^}]*\}\s*from\s*'\.\.\/\.\.\/core\/colors\.ts'/);
  });

  it('★ SettingsScreen 안에 색 이름 표가 **다시 선언돼 있지 않다**', () => {
    const code = codeOf(SRC);
    // 로컬 맵의 정체는 "hex 를 키로 쓰는 객체 리터럴" 이다. 이름(COLOR_NAMES)으로 찾으면
    // 변수명만 바꿔도 빠져나가므로 **모양**으로 찾는다.
    const hexKeys = code.match(/'#[0-9a-fA-F]{6}'\s*:/g) ?? [];
    expect(hexKeys, `설정 화면이 hex 키 표를 다시 갖고 있다: ${hexKeys.join(' ')}`).toEqual([]);
  });

  it('★ 이름 조회에 `?? c` 폴백이 없다 — 폴백이 곧 "빠져도 조용히 hex" 다', () => {
    const code = codeOf(SRC);
    expect(code).toContain('TEAM_COLOR_NAMES[c]');
    expect(code).not.toMatch(/TEAM_COLOR_NAMES\[c\]\s*\?\?/);
  });
});
