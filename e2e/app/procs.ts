// app 층의 프로세스 장부 — 이름·패턴으로 절대 죽이지 않는다. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/procs.ts 각색. Windows 쪽은 procs-win.ts — PID 추적 + taskkill, 표지 없음)
//
// app 층이 띄우는 모든 프로세스(Xvfb·dbus-daemon·gnome-keyring-daemon·tauri-driver)는 고유한 환경 표지
// `SPIN_E2E_RUN=<토큰>` 을 갖는다. 환경변수는 상속되므로 **그들이 띄운 것**(WebKitWebDriver·앱·WebKit 하위 프로세스·
// D-Bus 가 깨운 데몬 — 두 번 fork 해 init 에 입양된 것까지)도 표지를 갖는다. 정리는 `/proc/<pid>/environ` 을 읽어
// (읽히는 것은 우리 프로세스뿐이다) 이번 실행의 토큰을 가진 것만 끝낸다. 그 밖의 것은 건드리지 않는다.
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';

import { isAliveWin, killTree, listProcesses, treeOf } from './procs-win.ts';

const win = process.platform === 'win32';

export const MARKER = 'SPIN_E2E_RUN';

const pidsInProc = (): number[] =>
  readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number);

/** 환경에 `SPIN_E2E_RUN=<token>` 을 가진 PID(부르는 프로세스 자신은 뺀다) */
export function markedPids(token: string): number[] {
  if (win) return []; // Windows 는 남의 환경을 못 읽는다 — env-windows.ts 가 PID 를 따로 적는다
  const needle = `${MARKER}=${token}`;
  const found: number[] = [];
  for (const pid of pidsInProc()) {
    if (pid === process.pid) continue;
    try {
      const environ = readFileSync(`/proc/${pid}/environ`, 'latin1');
      if (environ.split('\0').includes(needle)) found.push(pid);
    } catch {
      // 남의 것이거나 이미 끝났다
    }
  }
  return found;
}

/** 보고서용 짧은 설명: `1234 Xvfb` */
export function describePid(pid: number): string {
  if (win) {
    const p = listProcesses().find((x) => x.pid === pid);
    return p ? `${pid} ${p.name}` : `${pid} (gone)`;
  }
  try {
    return `${pid} ${readlinkSync(`/proc/${pid}/exe`).split('/').pop()}`;
  } catch {
    try {
      return `${pid} ${readFileSync(`/proc/${pid}/comm`, 'utf8').trim()}`;
    } catch {
      return `${pid} (gone)`;
    }
  }
}

export function isAlive(pid: number): boolean {
  if (win) return isAliveWin(pid);
  try {
    // 좀비도 kill(0) 에 답한다 — 끝난 것으로 본다
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return !/^\d+ \(.*\) Z /.test(stat);
  } catch {
    return false;
  }
}

/** root 의 살아 있는 자손(직계·간접) */
export function descendants(root: number): number[] {
  if (win)
    return treeOf([root])
      .filter((p) => p.pid !== root)
      .map((p) => p.pid);
  const children = new Map<number, number[]>();
  for (const pid of pidsInProc()) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      // "pid (comm) state ppid …" — comm 에 공백·괄호가 있을 수 있어 마지막 ')' 뒤에서 자른다
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      (children.get(ppid) ?? children.set(ppid, []).get(ppid)!).push(pid);
    } catch {
      // 끝났다
    }
  }
  const out: number[] = [];
  const queue = [...(children.get(root) ?? [])];
  while (queue.length) {
    const pid = queue.shift()!;
    out.push(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  return out.filter(isAlive);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 주어진 PID 에 SIGTERM, graceMs 까지 기다리고 남은 것은 SIGKILL. SIGKILL 이 필요했던 PID 를 돌려준다 */
export async function terminate(pids: number[], graceMs = 3000): Promise<number[]> {
  const targets = pids.filter(isAlive);
  if (win) {
    // Windows 에는 SIGTERM 이 없다 — 나무째 끝낸다(자식 먼저는 부르는 쪽의 순서, 나머지는 /T 가 덮는다)
    for (const pid of targets) killTree(pid);
    const until = Date.now() + graceMs;
    while (Date.now() < until && targets.some(isAlive)) await pause(50);
    return targets.filter(isAlive);
  }
  for (const pid of targets) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // 이미 끝났다
    }
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline && targets.some(isAlive)) await pause(50);
  const stubborn = targets.filter(isAlive);
  for (const pid of stubborn) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // 이미 끝났다
    }
  }
  return stubborn;
}

/** pid 가 끝날 때까지(또는 상한까지) 기다린다. true = 끝났다 */
export async function waitExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await pause(50);
  }
  return !isAlive(pid);
}
