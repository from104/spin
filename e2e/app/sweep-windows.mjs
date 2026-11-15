#!/usr/bin/env node
// scripts/test-suite.sh 의 Windows 남은 것 쓸기 — Linux 의 /proc 표지 쓸기의 짝. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/sweep-windows.mjs 그대로 — 이미지 이름만 SPIN 것)
//
// Windows 프로세스에는 읽을 수 있는 실행 표지가 없어, env-windows.ts 가 띄운 PID(tauri-driver·msedgedriver·앱과 그 자식)를
// test-results/.app-run.json 에 적는다. 이것은 **바로 그 PID** 만 끝낸다(`taskkill /T /F /PID`) — 그 PID 가 아직 살아 있고
// 이미지 이름이 우리 것일 때만. Windows 가 그새 그 PID 를 남의 프로그램에 줬다면 건드리지 않는다. 이미지 이름만으로는 절대.
//
// 끝낸 프로세스 수를 찍는다.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const OURS = new Set(['tauri-driver.exe', 'msedgedriver.exe', 'spin.exe', 'msedgewebview2.exe']);
const file = process.argv[2] ?? 'test-results/.app-run.json';

let run;
try {
  run = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  console.log(0);
  process.exit(0);
}

const imageOf = (pid) => {
  const r = spawnSync('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  const m = /^"([^"]+)","(\d+)"/m.exec(r.stdout ?? '');
  return m && Number(m[2]) === pid ? m[1].toLowerCase() : null;
};

let ended = 0;
for (const pid of run.pids ?? []) {
  if (!Number.isInteger(pid) || pid <= 4) continue;
  const image = imageOf(pid);
  if (!image || !OURS.has(image)) continue;
  spawnSync('taskkill.exe', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  ended++;
}
if (ended) {
  run.pids = [];
  writeFileSync(file, JSON.stringify(run) + '\n');
}
console.log(ended);
