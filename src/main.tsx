import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/appShell.css'
import './styles/a11y.css'
// §5.6 고대비·강제색. a11y.css **뒤**여야 한다 — 같은 특정도로 :focus-visible 의 굵기·색을
// 덮어쓰는 파일이라, 앞으로 옮기면 prefers-contrast: more 에서 포커스 링이 2px 로 돌아간다
// (styles/contrast.test.tsx 가 순서를 못박는다). print.css 는 계속 맨 마지막이다.
import './styles/contrast.css'
import './index.css'
// ⚠️ 인쇄 스타일은 **맨 마지막**이어야 한다 — appShell.css 의 가둠(height:100%·overflow:hidden·
// safe-area 패딩)을 @media print 에서 되돌리는 파일이라, 같은 특정도에서 나중에 와야 이긴다.
// 앞으로 옮기면 60스텝 드릴 시트가 1페이지로 잘린다(styles/print.test.ts 가 순서를 못박는다).
import './styles/print.css'
import App from './app/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
