// native — 실제 데스크톱 앱만 보여 줄 수 있는 것: Tauri 명령(IPC)·네이티브 창·앱 프로세스·디스크의 프로필. app 층 전용.
// docs/PLAN-TEST-SUITE.md §11. (QCalc `feature/e2e-suite` 의 e2e/app/native.ts 의 자리 — 내용은 SPIN 의 src-tauri 에서 왔다)
//
// 지우면 새는 실기 버그(시나리오마다 한 줄 — 웹 층·vitest·cargo test 어디에도 없는 눈이다):
//  N1  웹뷰가 아무것도 안 그린다(흰 창) — 웹 빌드는 멀쩡해도 tauri:// 프로토콜·CSP·웹뷰 렌더가 따로 깨진다
//  N2  설치본이 제 버전을 틀리게 말한다 — 업데이터가 그 값으로 새 판을 고른다(tauri.conf.json "version": "../package.json")
//  N3  업데이터 확인이 서명 키·엔드포인트·권한(capabilities/desktop.json) 문제로 던진다 — 앱은 그 오류를 **조용히 삼키므로**
//      (useDesktopUpdate.ts) 사용자는 업데이트가 영영 안 오는 것으로만 겪는다. ⚠️ 확인(check)만 한다 — 받기·설치는 절대
//      부르지 않는다(deb 판의 설치는 `pkexec dpkg -i` 로 사용자의 진짜 세션에 암호 창을 띄울 수 있다)
//  N4  앱을 껐다 켜면 전술판·드릴이 사라진다 — 새로고침(S8)이 아니라 **프로세스 재시작** 너머의 WebKit 저장소(디스크)
//  N5  창이 최소 크기(minWidth 900·minHeight 600) 아래로 줄어 배치가 깨진다 · 첫 창 크기·제목이 설정과 다르다
//  N6  갱신 토큰이 앱 데이터 폴더 밖이나 남이 읽을 수 있는 권한(0600 아님)으로 놓인다(secret_store.rs)
//  N7  저장 명령이 날바디가 아닌 호출에도 대화 상자를 연다 — 바이트 없이 빈 파일을 쓰는 길(save_file.rs)
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { decodePng } from '../support/png.ts';
import type { CourtObject } from '../drivers/SpinApp.ts';
import { at, check, defineGroup, eventually, expectQuiet } from '../scenarios/kit.ts';
import { isWindows } from './platform.ts';
import type { TauriApp } from './tauri-app.ts';

/** tauri.conf.json 의 첫 창 — 기대값은 설정에서 온다 */
const CONF = JSON.parse(readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')) as {
  productName: string;
  app: { windows: Array<{ title: string; width: number; height: number; minWidth: number; minHeight: number }> };
};
const WINDOW = CONF.app.windows[0]!;
const PKG_VERSION = (JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as { version: string }).version;

/** 저장 뒤 다시 읽은 자세가 같은가 — 저장 꼴이 좌표를 반올림하므로(전술판 262.678 → 262.7, 첫 실측) 월드 단위 0.5 안이면 같다.
 *  개체 수·id·종류는 정확히 같아야 한다 */
const samePoses = (a: readonly CourtObject[], b: readonly CourtObject[]): boolean =>
  a.length === b.length &&
  a.every((o) => {
    const p = b.find((x) => x.id === o.id);
    return !!p && p.kind === o.kind && Math.abs(p.x - o.x) <= 0.5 && Math.abs(p.y - o.y) <= 0.5 && Math.abs(p.angleDeg - o.angleDeg) <= 0.5;
  });

/** 업데이터 check 의 응답 — 새 판이 없으면 null(플러그인 Rust 쪽 `Option<Metadata>`) */
interface UpdateMetadata {
  rid: number;
  currentVersion: string;
  version: string;
}

/** 화면 상자 안 화소 중 가장 흔한 색의 비율 — 1 에 가까우면 한 색으로 칠한 판(아무것도 안 그렸다) */
function dominantRatio(png: ReturnType<typeof decodePng>, box: { left: number; top: number; right: number; bottom: number }): number {
  const counts = new Map<number, number>();
  let total = 0;
  const x0 = Math.max(0, Math.floor(box.left));
  const x1 = Math.min(png.width, Math.ceil(box.right));
  const y0 = Math.max(0, Math.floor(box.top));
  const y1 = Math.min(png.height, Math.ceil(box.bottom));
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * png.width + x) * 4;
      const key = (png.rgba[i]! << 16) | (png.rgba[i + 1]! << 8) | png.rgba[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
  }
  return total ? Math.max(...counts.values()) / total : 1;
}

export default defineGroup<TauriApp>('native', [
  {
    title: 'N1 부팅하면 판이 그려진다',
    run: async (app) => {
      await app.step('Tauri 웹뷰다 — __TAURI_INTERNALS__ · tauri 출처', async () => {
        const internals = await app.js(() => typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
        check(internals === 'object', '__TAURI_INTERNALS__ 가 없다 — Tauri 웹뷰가 아니다', internals);
        const origin = app.session.origin;
        check(origin === (isWindows ? 'http://tauri.localhost' : 'tauri://localhost'), '앱 출처가 Tauri 사용자 정의 프로토콜이 아니다', origin);
      });
      await app.step('전술판 화면과 코트 무대', async () => {
        check((await app.screen()) === 'board', '첫 화면이 전술판이 아니다', await app.screen());
        const size = await app.courtSize();
        check(!!size && size.width > 200 && size.height > 200, '코트 무대가 없거나 너무 작다', size);
      });
      await app.step('웹뷰가 코트를 실제로 그렸다(스크린샷 화소)', async () => {
        const png = decodePng(new Uint8Array(await app.screenshotPng()));
        const box = await app.rectOf('court-stage');
        check(!!box, 'court-stage 가 없다');
        const ratio = dominantRatio(png, box);
        // 빈 웹뷰·흰 창이면 한 색이 거의 전부다. 코트(바닥·선·골대)는 여러 색이다
        check(ratio < 0.97, `코트 자리가 한 색으로 칠해져 있다(${(ratio * 100).toFixed(1)}%) — 웹뷰가 그리지 않았다`, ratio);
      });
      await expectQuiet(app, '부팅');
    },
  },
  {
    title: 'N2 앱 버전 = package.json',
    run: async (app) => {
      const version = await app.invoke<string>('plugin:app|version');
      check(version === PKG_VERSION, `plugin:app|version 이 package.json(${PKG_VERSION})과 다르다`, version);
      const name = await app.invoke<string>('plugin:app|name');
      check(name === CONF.productName, `plugin:app|name 이 productName(${CONF.productName})과 다르다`, name);
    },
  },
  {
    title: 'N3 업데이터 확인이 던지지 않는다',
    run: async (app) => {
      // ⚠️ check 만. download·install·downloadAndInstall 은 부르지 않는다(머리말 N3)
      const update = await app.invoke<UpdateMetadata | null>('plugin:updater|check', {});
      if (update === null) return; // 지금 판이 최신이다(엔드포인트의 latest.json 이 같거나 옛 판)
      check(update.currentVersion === PKG_VERSION, '업데이터가 보는 지금 판이 package.json 과 다르다', update.currentVersion);
      check(typeof update.version === 'string' && update.version !== PKG_VERSION, '새 판이라는데 버전이 같다', update.version);
    },
  },
  {
    title: 'N4 껐다 켜도 판과 드릴이 남는다',
    run: async (app) => {
      const boardPose = await app.step('전술판에 공 하나 → 저장', async () => {
        await app.placeFromTray('ball', at(0.3, 0.4), { via: 'drag' });
        await eventually('전술판 자동 저장', () => app.autosave(), 'saved', { timeout: 5_000 });
        return app.objects();
      });
      const drillPose = await app.step('드릴로 편집 → 휠체어 하나 더 → 저장(IndexedDB)', async () => {
        await app.saveBoardAsDrill();
        await app.placeFromTray('chair', at(0.6, 0.6), { via: 'drag' });
        await eventually('드릴 자동 저장', () => app.autosave(), 'saved', { timeout: 5_000 });
        return app.objects();
      });
      await app.step('창을 닫아 앱을 끝내고(정상 종료) 같은 프로필로 다시 띄운다', async () => {
        const before = app.appPid();
        await app.closeWindow();
        await app.relaunch();
        check(app.appPid() !== null && app.appPid() !== before, '앱 프로세스가 새로 뜨지 않았다', [before, app.appPid()]);
      });
      await app.step('전술판이 그대로(localStorage)', async () => {
        await app.openE2E('/');
        await eventually('전술판 자세(개체·자리)', () => app.objects(), (now) => samePoses(now, boardPose));
      });
      await app.step('드릴이 그대로(IndexedDB)', async () => {
        await app.openE2E('/drills');
        await app.openDrillCard(0);
        await eventually('드릴 자세(개체·자리)', () => app.objects(), (now) => samePoses(now, drillPose));
      });
      await app.step('저장소는 격리 프로필 안에 있다', async () => {
        const dir = app.appDataDir;
        check(statSync(dir, { throwIfNoEntry: false })?.isDirectory() === true, `앱 데이터 폴더가 격리 프로필에 없다: ${dir}`);
      });
      await expectQuiet(app, '재실행 뒤');
    },
  },
  {
    title: 'N5 창 크기·최소 크기·제목',
    needs: ['xwindow'],
    run: async (app) => {
      const [win] = await eventually('X 창 하나', async () => app.nativeWindows(), (w) => w.length === 1);
      await app.step(`첫 창 ${WINDOW.width}×${WINDOW.height} · 제목 ${WINDOW.title}`, async () => {
        check(win!.width === WINDOW.width && win!.height === WINDOW.height, 'X 창 크기가 tauri.conf.json 과 다르다', win);
        const inner = await app.innerSize();
        check(inner.width === WINDOW.width && inner.height === WINDOW.height, '웹뷰 크기가 X 창과 다르다', inner);
        const title = /= "(.*)"$/m.exec(app.nativeProp(win!.id, '_NET_WM_NAME'))?.[1];
        check(title === WINDOW.title, '창 제목(_NET_WM_NAME)이 tauri.conf.json 과 다르다', title);
      });
      await app.step(`최소 크기 힌트 ${WINDOW.minWidth}×${WINDOW.minHeight}`, async () => {
        const hints = app.nativeProp(win!.id, 'WM_NORMAL_HINTS');
        const min = /minimum size: (\d+) by (\d+)/.exec(hints);
        check(!!min && Number(min[1]) === WINDOW.minWidth && Number(min[2]) === WINDOW.minHeight, 'WM_NORMAL_HINTS 의 최소 크기가 설정과 다르다', min?.[0] ?? hints.trim());
      });
      await app.step('더 작게 청해도 최소 아래로 안 줄어든다', async () => {
        await app.requestWindowSize(WINDOW.minWidth - 300, WINDOW.minHeight - 200);
        const inner = await eventually('줄인 뒤 웹뷰', () => app.innerSize(), (s) => s.width !== WINDOW.width || s.height !== WINDOW.height);
        check(inner.width >= WINDOW.minWidth && inner.height >= WINDOW.minHeight, `최소 ${WINDOW.minWidth}×${WINDOW.minHeight} 아래로 줄었다`, inner);
      });
    },
  },
  {
    title: 'N6 갱신 토큰은 앱 폴더에 0600',
    run: async (app) => {
      const file = app.dataPath('google-refresh-token');
      await app.step('둑: 앱 데이터 폴더가 이번 격리 프로필이고 토큰이 아직 없다', async () => {
        // 이 확인이 틀리면 아래 secret_save 가 사용자의 진짜 갱신 토큰을 덮어쓴다 — 그래서 쓰기 전에 앱에게 직접 묻는다
        const resolved = await app.invoke<string>('plugin:path|resolve_directory', { directory: 14 /* BaseDirectory.AppData */ });
        check(path.resolve(resolved) === path.resolve(app.appDataDir), '앱 데이터 폴더가 격리 프로필이 아니다 — 멈춘다', resolved);
        check((await app.invoke<string | null>('secret_load')) === null, '새 프로필인데 갱신 토큰이 이미 있다 — 멈춘다');
      });
      const value = `e2e-not-a-token-${Date.now()}`;
      await app.step('저장 → 그 자리의 파일 · 소유자만 읽기', async () => {
        await app.invoke('secret_save', { value });
        const st = statSync(file, { throwIfNoEntry: false });
        check(!!st && st.isFile(), `토큰 파일이 앱 데이터 폴더에 없다: ${file}`);
        if (!isWindows) check((st.mode & 0o777) === 0o600, '토큰 파일 권한이 0600 이 아니다', (st.mode & 0o777).toString(8));
        check(readFileSync(file, 'utf8') === value, '토큰 파일 내용이 저장한 값과 다르다');
        check((await app.invoke<string | null>('secret_load')) === value, 'secret_load 가 저장한 값을 못 돌려준다');
      });
      await app.step('지우기 → 파일이 사라진다', async () => {
        await app.invoke('secret_clear');
        check(!statSync(file, { throwIfNoEntry: false }), '지운 뒤에도 토큰 파일이 남았다');
        check((await app.invoke<string | null>('secret_load')) === null, '지운 뒤 secret_load 가 값을 돌려준다');
      });
    },
  },
  {
    title: 'N7 저장 명령은 날바디만 받는다',
    run: async (app) => {
      // 대화 상자를 띄우지 않고 닿는 유일한 둑이다 — 날바디(바이트)가 아닌 JSON 인자는 대화 상자 전에 거절해야 한다
      const error = await app.invoke('save_bytes_dialog', { filename: 'x.png' }).then(
        () => null,
        (e: unknown) => String(e),
      );
      check(error !== null && /날바디가 아니다/.test(error), 'JSON 인자의 save_bytes_dialog 가 거절되지 않았다', error);
      if (app.capabilities.has('xwindow')) check(app.nativeWindows().length === 1, '저장 대화 상자 창이 떴다', app.nativeWindows());
    },
  },
]);
