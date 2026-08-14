import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 버전 문자열은 package.json 하나에서만 나온다 — 화면에 박아 두면 릴리스 때 반드시 어긋난다.
// package.json 을 import 하면 번들에 파일 전체가 들어가므로 값만 뽑아 주입한다.
const pkgVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
