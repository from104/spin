// W3C WebDriver(classic) 최소 클라이언트 — 실제 앱 층(e2e/app)이 tauri-driver 와 말하는 길. docs/PLAN-TEST-SUITE.md §11.
//
// QCalc 는 같은 자리에 WebdriverIO 9.32 를 쓴다. SPIN 은 쓰지 않는다 — 2026-11-15 에 넣어 보니 의존 패키지 약 240개가
// 잠금 파일을 2,800줄 늘렸고 `npm audit` 이 0건에서 14건(높음 10 — @puppeteer/browsers·proxy-agent 줄기)이 됐다.
// 우리가 쓰는 명령은 열 개 남짓이고(세션·주소·스크립트·입력 동작·스크린샷·창) 프로토콜은 W3C 표준이라
// 노드 내장 fetch 로 충분하다. 요소 참조(element id)는 쓰지 않는다 — 누르기는 페이지 안에서 잰 화면 점에
// 포인터 동작을 보내는 것이 전부다(e2e/drivers/WdioApp.ts).
//
// 스크립트는 늘 `execute/async` 로 보낸다: 함수가 Promise 를 돌려도, 던져도 같은 꼴({ok, value|error})로 돌아와
// 앱 쪽 오류 문구가 WebDriver 의 "javascript error" 포장에 묻히지 않는다. 함수는 toString() 으로 직렬화되므로
// 바깥 변수를 참조하면 안 된다(Playwright 의 page.evaluate 와 같은 규칙).

/** WebDriver 키 코드(W3C 「Keyboard actions」 표) — Playwright 표기 이름 → 코드 포인트 */
export const KEY_CODES: Readonly<Record<string, string>> = {
  Control: '',
  Shift: '',
  Alt: '',
  Meta: '',
  Enter: '',
  Backspace: '',
  Delete: '',
  Escape: '',
  Tab: '',
  Space: ' ',
  Home: '',
  End: '',
  PageUp: '',
  PageDown: '',
  ArrowLeft: '',
  ArrowUp: '',
  ArrowRight: '',
  ArrowDown: '',
};

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 입력 동작 하나 — W3C 「Actions」 의 action item 그대로 */
export type ActionItem = Record<string, unknown>;
/** 입력 장치 하나와 그 동작 열 */
export interface ActionSequence {
  type: 'pointer' | 'key' | 'wheel' | 'none';
  id: string;
  parameters?: Record<string, unknown>;
  actions: ActionItem[];
}

/** WebDriver 가 돌려준 오류 — `error` 는 W3C 오류 코드('no such window', 'invalid session id' 등) */
export class WebDriverError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

async function request<T>(method: string, url: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json; charset=utf-8' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((error: unknown) => {
    throw new Error(`WebDriver ${method} ${new URL(url).pathname} 실패: ${String(error)}`, { cause: error });
  });
  const text = await res.text();
  let payload: { value?: unknown } = {};
  try {
    payload = text ? (JSON.parse(text) as { value?: unknown }) : {};
  } catch {
    throw new Error(`WebDriver ${method} ${new URL(url).pathname}: JSON 이 아닌 응답(${res.status}) ${text.slice(0, 200)}`);
  }
  const value = payload.value as { error?: string; message?: string } | undefined;
  if (!res.ok || (value && typeof value === 'object' && typeof value.error === 'string')) {
    throw new WebDriverError(value?.error ?? `http ${res.status}`, String(value?.message ?? text).split('\n')[0]!.slice(0, 300));
  }
  return payload.value as T;
}

/** 실행 결과 봉투 — 페이지 안에서 잡은 오류를 그대로 들고 온다 */
type Envelope = { ok: true; value: unknown } | { ok: false; error: string };

export class WebDriverSession {
  readonly id: string;
  private readonly base: string;

  private constructor(base: string, id: string) {
    this.base = base;
    this.id = id;
  }

  /** 새 세션 — tauri-driver 에서는 곧 앱 프로세스 하나를 띄우는 일이다 */
  static async create(endpoint: string, capabilities: Record<string, unknown>, timeoutMs: number): Promise<WebDriverSession> {
    const value = await request<{ sessionId: string }>('POST', `${endpoint}/session`, { capabilities: { alwaysMatch: capabilities } }, timeoutMs);
    const session = new WebDriverSession(endpoint, value.sessionId);
    // 비동기 스크립트 상한 — 굽기·IndexedDB 처럼 오래 걸리는 페이지 안 기다림을 덮는다(기본 30초는 Playwright 시험 상한과 같아 이름 없는 타임아웃이 된다)
    await session.cmd('POST', '/timeouts', { script: 20_000, pageLoad: 30_000 });
    return session;
  }

  private cmd<T>(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
    return request<T>(method, `${this.base}/session/${this.id}${path}`, body ?? (method === 'POST' ? {} : undefined), timeoutMs);
  }

  /**
   * 페이지 안에서 fn(...args) 를 돌려 결과를 돌려준다. fn 이 던지거나 거절하면 그 문구 그대로 던진다.
   * 인자·결과는 JSON 으로 오간다.
   */
  async execute<A extends unknown[], R>(fn: (...args: A) => R | Promise<R>, ...args: A): Promise<R> {
    const script =
      'const done = arguments[arguments.length - 1];' +
      'const args = Array.prototype.slice.call(arguments, 0, -1);' +
      `Promise.resolve().then(() => (${fn.toString()}).apply(null, args)).then(` +
      '(value) => done({ ok: true, value: value === undefined ? null : value }),' +
      '(e) => done({ ok: false, error: String(e && e.message ? e.message : e) }));';
    const r = await this.cmd<Envelope>('POST', '/execute/async', { script, args }, 25_000);
    if (!r.ok) throw new Error(r.error);
    return r.value as R;
  }

  /** 주소로 간다(문서 적재가 끝날 때까지 — 쪽 적재 전략 normal) */
  async navigate(url: string): Promise<void> {
    await this.cmd('POST', '/url', { url }, 40_000);
  }

  url(): Promise<string> {
    return this.cmd<string>('GET', '/url');
  }

  async refresh(): Promise<void> {
    await this.cmd('POST', '/refresh', {}, 40_000);
  }

  async performActions(actions: ActionSequence[]): Promise<void> {
    await this.cmd('POST', '/actions', { actions });
  }

  /** 눌린 키·단추를 전부 뗀다(입력 상태 표를 비운다) */
  async releaseActions(): Promise<void> {
    await this.cmd('DELETE', '/actions');
  }

  /** 문서(뷰포트) 스크린샷 — PNG base64 */
  screenshot(): Promise<string> {
    return this.cmd<string>('GET', '/screenshot');
  }

  windowRect(): Promise<WindowRect> {
    return this.cmd<WindowRect>('GET', '/window/rect');
  }

  setWindowRect(rect: Partial<WindowRect>): Promise<WindowRect> {
    return this.cmd<WindowRect>('POST', '/window/rect', rect);
  }

  /** 지금 창을 닫는다 — 사람이 창의 [X] 를 누른 것과 같다. 마지막 창이면 앱이 스스로 끝난다(정상 종료) */
  async closeWindow(): Promise<void> {
    await this.cmd('DELETE', '/window', undefined, 15_000);
  }

  /** 세션을 끝낸다 — tauri-driver 는 앱 프로세스를 죽인다(정상 종료가 아니다) */
  async delete(): Promise<void> {
    await request('DELETE', `${this.base}/session/${this.id}`, undefined, 15_000);
  }
}
