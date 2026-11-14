// S3 첫 방문 순서 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 2026-09-16 T7 사고 — 작은 화면 안내·[시작하기]·화면 투어가 한 화면에 같이 떠
// `aria-modal` 이 둘 서고, [다음] 을 누르면 엉뚱한 쪽이 먹었다(AppShell.tsx 의 welcomeDecided 주석).
// 가짜 시계는 두 effect 를 한 flush 로 묶어 그 중간 커밋을 못 봤다 — 진짜 브라우저의 DOM 변이를 매번 세는
// 감시자(드라이버의 modalLog)만 "어느 순간에도 하나" 를 잴 수 있다. 닫은 뒤 새로고침하면 다시 안 떠야 한다
// (도장이 저장된다).
//
// 순서: 로더 → (작은 화면만: 작은 화면 안내) → [시작하기] 온보딩 → 화면 투어. 로더가 덮고 있는 동안에는
// 아무 대화 상자도 서지 않는다(덮인 채로 열면 안 보이는 모달에 갇힌다 — 결정 30).
import { check, defineGroup, eventually } from './kit.ts';
import type { SpinApp } from '../drivers/SpinApp.ts';

/** 지금 대화 상자가 하나 설 때까지 기다려 그 이름을 돌려준다 */
async function nextDialog(app: SpinApp, label: string): Promise<string> {
  const ids = await eventually(label, () => app.dialogs(), (d) => d.length > 0, { timeout: 8_000 });
  return ids[0]!;
}

export default defineGroup('firstRun', [
  {
    title: 'S3 첫 방문 대화 상자 순서',
    seed: { profile: 'fresh' },
    needs: ['reload', 'keyboard'],
    run: async (app) => {
      // 작은 화면 기기(chromium-mobile)인지는 첫 대화 상자가 말해 준다 — 시나리오가 기기 판정 숫자를 베끼지 않는다
      let first = await nextDialog(app, '첫 대화 상자');
      if (first === 'small-screen-notice') {
        await app.step('작은 화면 안내 — [다시 보지 않기] 켜고 닫기', async () => {
          await app.checkNoticeOptOut();
          await app.pressKey('Escape');
          await eventually('안내가 닫힘', () => app.dialogs(), (d) => !d.includes('small-screen-notice'));
        });
        first = await nextDialog(app, '안내 다음 대화 상자');
      }
      check(first === 'onboarding', `첫 방문 첫 대화 상자가 [시작하기] 가 아니다`, first);

      await app.step('[시작하기] 끝까지 넘기기', async () => {
        for (let page = 0; page < 10 && (await app.dialogs()).includes('onboarding'); page++) {
          await app.press('onboarding-next');
        }
        await eventually('온보딩이 닫힘', () => app.dialogs(), (d) => !d.includes('onboarding'));
      });

      check((await nextDialog(app, '투어')) === 'tutorial-overlay', '온보딩 다음이 화면 투어가 아니다', await app.dialogs());
      await app.pressKey('Escape'); // 투어 건너뛰기(TutorialOverlay: Esc = skip)
      await eventually('투어가 닫힘', () => app.dialogs(), (d) => d.length === 0);

      const log = await app.modalLog();
      check(log.max <= 1, `aria-modal 이 한 순간에 ${log.max}개 섰다`, log.overlaps);
      check(log.underLoader.length === 0, '로더가 덮고 있는 동안 대화 상자가 섰다', log.underLoader);
      const expected = log.order.includes('small-screen-notice')
        ? ['small-screen-notice', 'onboarding', 'tutorial-overlay']
        : ['onboarding', 'tutorial-overlay'];
      check(JSON.stringify(log.order) === JSON.stringify(expected), `대화 상자 순서 — 기대 ${expected.join('→')}`, log.order);

      await app.step('새로고침하면 아무것도 안 뜬다', async () => {
        await app.reload();
        // 준비 판정이 로더 덮개가 걷힌 뒤다. 게이트들은 덮개가 걷힌 다음 커밋에서 판정한다 — 그 판정이 끝날
        // 여유를 화면 정착(다리 busy·자세 두 프레임 동일)으로 준다. 고정 sleep 이 아니라 다음 페인트들이다.
        await app.settled();
        const after = await app.modalLog();
        check(after.order.length === 0, '닫았던 첫 방문 대화 상자가 새로고침 뒤 다시 떴다', after.order);
      });
    },
  },
]);
