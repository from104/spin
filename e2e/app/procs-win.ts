// procs.ts 의 Windows 쪽 — /proc 도, 남의 환경을 읽을 길도 없어 실행 표지가 없다. app 층은 자기가 띄운 PID(와 그 자손)를
// 적어 두고 `taskkill /T /F /PID <pid>` 로 끝낸다 — 이미지 이름으로는 절대 안 끝낸다. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/procs-win.ts 그대로 — Windows 러너에서만 검증된다)
import { spawnSync } from 'node:child_process';

export interface WinProc {
  pid: number;
  ppid: number;
  name: string;
  exe: string | null;
}

/** 지금 도는 프로세스 전부(PowerShell/CIM 한 번, 0.5~1초) */
export function listProcesses(): WinProc[] {
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Get-CimInstance Win32_Process | ForEach-Object { '{0}|{1}|{2}|{3}' -f $_.ProcessId, $_.ParentProcessId, $_.Name, $_.ExecutablePath }",
    ],
    { encoding: 'utf8', timeout: 30_000, windowsHide: true },
  );
  if (r.status !== 0) throw new Error(`프로세스 목록 실패: ${r.stderr || r.error}`);
  const out: WinProc[] = [];
  for (const line of r.stdout.split(/\r?\n/)) {
    const [pid, ppid, name, ...exe] = line.split('|');
    if (!/^\d+$/.test(pid ?? '')) continue;
    out.push({ pid: Number(pid), ppid: Number(ppid), name: name ?? '', exe: exe.join('|').trim() || null });
  }
  return out;
}

/** roots 와 그 아래 전부(부모 PID 로), 목록 한 번에서 */
export function treeOf(roots: number[], procs: WinProc[] = listProcesses()): WinProc[] {
  const byParent = new Map<number, WinProc[]>();
  for (const p of procs) (byParent.get(p.ppid) ?? byParent.set(p.ppid, []).get(p.ppid)!).push(p);
  const seen = new Set<number>();
  const out: WinProc[] = [];
  const queue = procs.filter((p) => roots.includes(p.pid));
  while (queue.length) {
    const p = queue.shift()!;
    if (seen.has(p.pid) || p.pid === process.pid) continue;
    seen.add(p.pid);
    out.push(p);
    queue.push(...(byParent.get(p.pid) ?? []));
  }
  return out;
}

export function isAliveWin(pid: number): boolean {
  try {
    process.kill(pid, 0); // libuv 가 종료 코드를 본다 — 끝난 프로세스는 ESRCH
    return true;
  } catch {
    return false;
  }
}

/** `taskkill /T /F /PID` — 그 프로세스와 그것이 띄운 것들 */
export function killTree(pid: number): void {
  spawnSync('taskkill.exe', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', timeout: 15_000, windowsHide: true });
}
