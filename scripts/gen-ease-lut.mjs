#!/usr/bin/env node
// src/core/geom.ts 의 EASE_STANDARD_LUT(129점) 를 다시 만든다.
//
// 왜 스크립트인가: 표는 소스에 하드코딩돼 있다 — 모듈 로드 시점의 부동소수 계산 순서에
// 결정성 테스트가 의존하지 않게 하려는 것이다(그 파일 주석 참고). 그래서 런타임에는 솔버가
// 필요 없고, 앱 번들에 죽은 export 로 남을 이유도 없다. 표를 고칠 일이 생기면 여기서 찍는다.
//
//   node scripts/gen-ease-lut.mjs           # 표를 소스 형식(8개씩 줄바꿈)으로 출력
//   node scripts/gen-ease-lut.mjs --check   # 현재 geom.ts 의 표와 일치하는지만 검증
//
// 표준 cubic-bezier(p1x,p1y,p2x,p2y) 타이밍 함수 — CSS cubic-bezier() 와 같은 WebKit
// UnitBezier 알고리즘(Newton–Raphson 4회 + 이분 보정). 2026-08-31 까지 core/geom.ts 에
// `cubicBezier` 로 살아 있었으나, 표를 찍는 것 말고는 호출자가 없어 이리로 옮겼다.

import { readFileSync } from 'node:fs';

function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleCurveDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  function solveCurveX(x) {
    let t = x;
    for (let i = 0; i < 4; i++) {
      const dx = sampleCurveX(t) - x;
      const d = sampleCurveDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const x2 = sampleCurveX(t);
      if (Math.abs(x2 - x) < 1e-7) break;
      if (x2 < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleCurveY(solveCurveX(x));
  };
}

// 표는 둘이다(2026-09-08, PLAN-STEP-LINK §결정 3 — 딜레이 없는 연결의 구간 이징).
// - EASE_STANDARD_LUT = cubic-bezier(.4,0,.2,1) — in-out(§3.6/§6).
// - EASE_ACCEL_LUT    = cubic-bezier(.4,0,1,1)  — in(가속). **감속(ease-out)은 이 표의
//   거울상**(`1 - easeIn(1-t)` = cubic-bezier(0,0,.6,1))이라 표를 하나 더 찍지 않는다:
//   연속 구간의 양 끝이 정확히 대칭이 되는 것이 오히려 값이다.
const TABLES = [
  { name: 'EASE_STANDARD_LUT', args: [0.4, 0, 0.2, 1] },
  { name: 'EASE_ACCEL_LUT', args: [0.4, 0, 1, 1] },
];

const cellsOf = (args) => {
  const ease = cubicBezier(...args);
  return Array.from({ length: 129 }, (_, i) => ease(i / 128).toFixed(12));
};

if (process.argv.includes('--check')) {
  const src = readFileSync(new URL('../src/core/geom.ts', import.meta.url), 'utf8');
  for (const { name, args } of TABLES) {
    const cells = cellsOf(args);
    const block = src.match(new RegExp(`${name}: readonly number\\[\\] = \\[([\\s\\S]*?)\\];`));
    if (!block) {
      console.error(`geom.ts 에서 ${name} 를 찾지 못했다`);
      process.exit(1);
    }
    const have = block[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const bad = cells.findIndex((c, i) => c !== have[i]);
    if (have.length !== cells.length || bad >= 0) {
      console.error(`${name} 불일치: 길이 ${have.length}/${cells.length}, 첫 어긋난 자리 ${bad}`);
      process.exit(1);
    }
    console.log(`${name} 일치 — ${cells.length}점`);
  }
} else {
  for (const { name, args } of TABLES) {
    const cells = cellsOf(args);
    console.log(`// ${name}`);
    for (let i = 0; i < cells.length; i += 8) {
      console.log('  ' + cells.slice(i, i + 8).join(', ') + ',');
    }
  }
}
