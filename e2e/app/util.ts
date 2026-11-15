// app 층의 호스트 중립 작은 도구 — env-linux.ts·env-windows.ts 가 함께 쓴다. docs/PLAN-TEST-SUITE.md §11.
// (QCalc `feature/e2e-suite` 의 e2e/app/util.ts 그대로)
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';

/** 지금 비어 있는 127.0.0.1 포트 하나 */
export const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

/** url 이 200 을 돌려줄 때까지 기다린다(서버가 아직 안 들었으면 다시) */
export async function waitHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // 아직 안 듣는다
    }
    if (Date.now() > deadline) throw new Error(`${url} 이(가) ${timeoutMs}ms 안에 뜨지 않음`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** PATH 에서 name 의 첫 자리(Windows 는 PATHEXT 확장자도) */
export function which(name: string): string | null {
  const exts = process.platform === 'win32' ? ['', ...(process.env.PATHEXT ?? '.EXE').split(';')] : [''];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}
