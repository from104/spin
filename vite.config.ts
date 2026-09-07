import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 버전 문자열은 package.json 하나에서만 나온다 — 화면에 박아 두면 릴리스 때 반드시 어긋난다.
// package.json 을 import 하면 번들에 파일 전체가 들어가므로 값만 뽑아 주입한다.
const PKG_PATH = fileURLToPath(new URL('./package.json', import.meta.url))
const pkgVersion = JSON.parse(readFileSync(PKG_PATH, 'utf-8')).version

/** package.json 의 version 이 바뀌면 개발 서버를 다시 세운다 (2026-09-02).
 *
 *  **왜 필요한가.** 위 `pkgVersion` 은 이 설정 파일이 **뜰 때 딱 한 번** 읽힌다. Vite 는
 *  `vite.config.ts` 자체는 감시해서 자동 재시작하지만, 설정이 *읽어 들이는* 파일까지는
 *  모른다. 그래서 릴리스로 버전을 올려도 이미 떠 있는 개발 서버는 **옛 번호를 계속 보여준다.**
 *
 *  실제로 그렇게 됐다: 0.6.0 으로 올린 뒤에도 화면이 0.5.99 였고, 개발 서버가 이틀째
 *  같은 프로세스였다는 걸 알아채기까지 시간이 걸렸다. 코드는 HMR 로 최신인데 **번호 하나만**
 *  낡아 있어서, 겉으로는 "빌드가 반영이 안 되나?" 로 보이는 것이 이 함정의 고약한 점이다.
 *
 *  ⚠️ 번호가 **실제로 달라졌을 때만** 다시 세운다. package.json 은 `npm install` 만 해도
 *  써지는 파일이라, 쓰였다고 무조건 재시작하면 의존성 하나 추가할 때마다 서버가 죽었다 산다. */
function restartOnVersionChange(): Plugin {
  return {
    name: 'spin:restart-on-version-change',
    // 빌드는 매번 새 프로세스라 이 문제가 없다 — 개발 서버에서만 단다.
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(PKG_PATH)
      server.watcher.on('change', (file) => {
        if (file !== PKG_PATH) return
        let next: string
        try {
          next = JSON.parse(readFileSync(PKG_PATH, 'utf-8')).version
        } catch {
          // 쓰는 중간에 읽으면 반쪽 JSON 일 수 있다. 다음 change 에 다시 온다.
          return
        }
        if (next === pkgVersion) return
        server.config.logger.info(`[spin] 버전 ${pkgVersion} → ${next} · 개발 서버를 다시 세웁니다.`)
        void server.restart()
      })
    },
  }
}

// 데스크톱 client_secret 이 웹 번들로 새던 구멍(2026-09-05 감사, [치명 2]) — Vite 는 기본적으로
// `.env.local` 의 `VITE_*` 를 **웹이든 데스크톱이든 구분 없이** 번들에 인라인한다. 그런데
// `SPIN_DESKTOP_GOOGLE_CLIENT_SECRET` 은 데스크톱(Tauri)에서만 필요하고, `npm run deploy:aws`
// 같은 웹 빌드에 들어가면 공개 서버로 그대로 나간다. `envPrefix` 로 Tauri 빌드일 때만
// `SPIN_DESKTOP_` 접두어도 허용해, 웹 빌드에서는 그 값이 애초에 `import.meta.env` 에 존재하지
// 않게 막는다. `TAURI_ENV_PLATFORM` 은 Tauri CLI 가 beforeDevCommand/beforeBuildCommand 를 부를
// 때만 넣어 주는 변수라 이 갈림의 신뢰할 판별자다.
//
// 여기서 "동적 import 로 분리"하지 않는 이유: 별도 청크로 쪼개도 그 청크 파일 자체가
// `npm run build` 산출물로 공개 서버(dist/)에 그대로 오른다 — 시크릿을 옮겨 실을 뿐 감추지
// 못한다. 또 `authDesktop.ts` 의 `isDesktop()`·`isConfigured()` 는 동기 호출이라 정적 import 를
// 요구한다. 그래서 값 자체를 웹 빌드에 아예 주입하지 않는 이 방식으로 막는다.
const isTauriBuild = process.env.TAURI_ENV_PLATFORM !== undefined;

// https://vite.dev/config/
export default defineConfig({
  envPrefix: isTauriBuild ? ['VITE_', 'SPIN_DESKTOP_'] : ['VITE_'],
  plugins: [react(), restartOnVersionChange()],
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  server: {
    // cube 밖(gofu 등 같은 LAN)에서 붙을 수 있게 0.0.0.0 바인딩.
    // 기본값(localhost)이면 cube 안에서만 열린다.
    host: true,
    port: 5173,
    // 포트가 이미 잡혀 있으면 조용히 다음 포트로 옮겨가지 말고 그냥 실패하라.
    // 실제 사고: dev 서버를 두 번 띄운 걸 모르고 있었는데, 두 번째가 5174 로 밀려나
    // 새 코드는 5174 에 뜨고 브라우저는 17시간 된 5173 을 계속 보고 있었다.
    // cube 에서 curl 로 확인해도 낡은 서버가 200 을 주므로 끝까지 안 잡힌다.
    strictPort: true,
    // Vite 의 DNS 리바인딩 보호. IP 로 붙을 땐 필요 없지만 호스트명으로 붙으려면 여기 있어야
    // 통과한다(없으면 403 "Blocked request").
    //  · cube / cube.local, gofu / gofu.local — 같은 LAN 에서 호스트명으로. 개발 서버는
    //    두 기기 어디서든 뜨므로 양쪽을 다 적는다(2026-08-14 기현님 지시로 gofu 추가).
    //  · .ts.net           — 테일넷 MagicDNS(cube.tail4fa6d9.ts.net · gofu.tail4fa6d9.ts.net).
    //    앞 점은 하위 도메인 와일드카드다. cube 는 ts-input 체인이 ufw 보다 앞에서
    //    tailscale0 인입을 전부 통과시켜 방화벽을 안 열어도 됐지만, **gofu 는 다르다** —
    //    ufw 에 `100.64.0.0/10 ALLOW IN` 규칙이 따로 있어야 한다(2026-08-14 확인).
    allowedHosts: ['cube', 'cube.local', 'gofu', 'gofu.local', '.ts.net'],
    // 공유 링크 백엔드(server/share, `npm run share:dev`)를 같은 출처로 붙인다.
    // ⚠️ 앱이 API 주소를 아는 방식은 **상대 경로 하나**여야 한다(PLAN-SHARE-LINK 결정 3 —
    //    도메인 독립). 개발에서 `http://localhost:8787` 을 직접 부르면 출처가 갈려 CORS·쿠키·
    //    링크 origin 이 운영과 다른 길을 타고, 운영에서만 나는 버그가 생긴다. 그래서 개발도
    //    운영(Apache ProxyPass)과 **같은 모양**으로 `/api` 를 그대로 넘긴다.
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: ['cube', 'cube.local', 'gofu', 'gofu.local', '.ts.net'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // src/ 아래 *.test.ts(x) 만 수집한다 — 안 그러면 .scratch/ 의 에이전트 작업용 프로브
    // 테스트까지 `npm test` 가 주워 실패로 잡고, 로컬 게이트가 흐려진다(.scratch 는
    // gitignore 되므로 CI 는 원래도 안전했다).
    // server/ 는 앱 번들이 아니라 공유 링크 백엔드(의존성 0, Node 가 .ts 를 바로 돈다)다.
    // 여기 include 에 없으면 `npm test` 가 그 계약을 **한 번도 안 본다** — 서버가 조용히
    // 깨져도 앱 테스트는 전부 초록이다.
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
})
