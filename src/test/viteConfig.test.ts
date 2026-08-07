// vite.config.ts 의 test.include 회귀 고정 — 이게 없으면 `npm test`(vitest run) 가 gitignore 된
// .scratch/ 의 에이전트 프로브 테스트까지 수집해 로컬 게이트를 오염시킨다(감사 minor #13).
//
// vite.config.ts 를 모듈로 import 하지 않는다 — `defineConfig`(from 'vite')는 vitest 의
// `test` 필드를 타입으로 모른다(그러려면 'vitest/config' 의 defineConfig 가 필요한데, 이건
// 이 파일의 담당 범위 밖인 별개 이슈다). import 로 끌어오면 tsconfig.app.json 의 include(=
// "src") 밖에 있는 vite.config.ts 가 프로젝트 타입체크 그래프에 끌려 들어와 무관한 타입
// 오류를 낸다 — 그래서 파일 내용을 텍스트로만 검사한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest 는 vite.config.ts 의 root(프로젝트 루트) 기준으로 프로세스를 띄운다.
const viteConfigPath = resolve(process.cwd(), 'vite.config.ts');
const source = readFileSync(viteConfigPath, 'utf-8');

describe('vite.config.ts — test.include', () => {
  it('src/ 아래 *.test.ts(x) 만 수집하도록 include 가 제한되어 있다', () => {
    // vite.config.ts 를 모듈로 로드하지 않으므로(위 주석 참조) 텍스트 검사로 대신한다.
    const includeMatch = source.match(/include:\s*\[([^\]]*)\]/);
    expect(includeMatch, 'vite.config.ts 의 test 블록에 include 배열이 없다').not.toBeNull();
    const includeBody = includeMatch![1]!;
    expect(includeBody).toContain('src/**/*.test.');
    // .scratch 를 여는 패턴이 섞여 들어가지 않았는지도 확인한다.
    expect(includeBody).not.toContain('.scratch');
  });
});
