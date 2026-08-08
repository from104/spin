import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // cube 밖(gofu 등 같은 LAN)에서 붙을 수 있게 0.0.0.0 바인딩.
    // 기본값(localhost)이면 cube 안에서만 열린다.
    host: true,
    // Vite 의 DNS 리바인딩 보호. IP 로 붙을 땐 필요 없지만 http://cube:5173 처럼
    // 호스트명으로 붙으려면 여기 있어야 통과한다.
    allowedHosts: ['cube', 'cube.local'],
  },
  preview: {
    host: true,
    allowedHosts: ['cube', 'cube.local'],
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
