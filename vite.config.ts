import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
