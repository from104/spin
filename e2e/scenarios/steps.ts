// S7 스텝 추가 + 재생 — docs/PLAN-TEST-SUITE.md §5.
//
// 지우면 새는 실기 버그: 실제 rAF·트윈 시계 위의 재생이 끝 스텝에서 멈추지 않거나(loop 꺼짐인데 처음으로
// 돌아감), 멈춘 뒤 화면 자세가 마지막 스텝이 아닌 중간에 걸리는 것, 재생 표시(playing)가 안 내려가 단추가
// [일시정지] 로 남는 것. 그래서 이 시나리오만 감축 모션을 끄고(`'system'`) 진짜 트윈 경로를 돈다 — 나머지는
// 시드가 감축 모션이라 트윈이 0ms 다.
import { at, check, defineGroup, eventually, expectNear, expectQuiet, objectById, poseKey, shift } from './kit.ts';

export default defineGroup('steps', [
  {
    title: 'S7 2스텝 재생이 끝에서 멈춘다',
    seed: { prefs: { a11y: { reduceMotion: 'system' } } },
    needs: ['keyboard'],
    run: async (app) => {
      // 스텝·재생은 드릴에만 있다 — 전술판에 공을 하나 놓고 [드릴로 편집] 으로 새 드릴을 만든다.
      // 끌어다 놓는다 — 탭으로 놓고 곧바로 끌면 더블탭으로 묶이는 앱 버그(S5b)에 휘말린다
      await app.placeFromTray('ball', at(0.35, 0.5), { via: 'drag' });
      await app.saveBoardAsDrill();
      await app.settled();
      const step1 = await app.objects();
      check(step1.length === 1 && step1[0]!.kind === 'ball', '새 드릴 1스텝에 공 하나가 아니다', step1);
      const id = step1[0]!.id;

      await app.addStep();
      await eventually('스텝 추가', () => app.stepState(), (s) => s.stepCount === 2 && s.stepIndex === 1);
      await app.settled();

      const from = await app.objectCenter(id);
      check(from !== null, '공이 화면에 없다');
      await app.drag(from, shift(from, 90, 0));
      await app.settled();
      const step2 = await app.objects();
      check(poseKey(step2) !== poseKey(step1), '2스텝에서 끈 자세가 1스텝과 같다', step2);

      await app.selectStep(0);
      await eventually('1스텝 고르기', () => app.stepState(), (s) => s.stepIndex === 0);
      await app.settled();
      check(poseKey(await app.objects()) === poseKey(step1), '1스텝으로 돌아왔는데 자세가 1스텝이 아니다', await app.objects());

      await app.togglePlay();
      await eventually('재생 시작', () => app.stepState(), (s) => s.playing, { timeout: 3_000 });
      // 2스텝 재생 = 스텝 간격 한 번 + 트윈. 기본 배속에서 몇 초 — 끝나면 playing 이 스스로 내려간다
      const end = await eventually('재생이 끝 스텝에서 멈춤', () => app.stepState(), (s) => !s.playing, { timeout: 15_000 });
      check(end.stepIndex === 1, '재생이 끝 스텝에서 멈추지 않았다', end);
      await app.settled();
      check(poseKey(await app.objects()) === poseKey(step2), '재생 뒤 모델 자세가 2스텝이 아니다', await app.objects());
      // 그려진 자리도 2스텝 자세다(트윈이 끝까지 갔다) — 모델→CTM 투영과 실제 bbox 중심을 맞댄다
      expectNear('재생 뒤 공의 화면 중심', await app.objectCenter(id), await app.worldToScreen(await objectById(app, id)));
      await expectQuiet(app, 'S7');
    },
  },
  {
    // 지우면 새는 실기 버그: 좁은·세로 창에서 연 스텝 목록을 연 그 단추로 닫을 수 없다 — 단추 이름은 "스텝 목록
    // 닫기" 로 바뀌는데 열린 목록(z 25)과 덮개(z 24)가 단추(z 20)를 덮는다. 사람은 바깥을 누르는 길밖에 없다.
    title: 'S7b 좁은 창의 스텝 목록을 연 단추로 닫는다',
    needs: ['keyboard'],
    // 2026-11-15 졸업: 열리면 단추가 목록 위(zIndex 26)·목록 오른쪽 바깥으로 옮겨 선다(StepSidebar).
    run: async (app) => {
      // 접힘 모드는 좁은 창에서 선다 — 데스크톱 엔진은 창을 Pixel 7 크기로 줄여 같은 배치를 받는다
      if (app.capabilities.has('resize')) await app.resize(412, 839);
      await app.placeFromTray('ball', at(0.35, 0.5), { via: 'drag' });
      await app.saveBoardAsDrill();
      check(await app.present('step-list-toggle'), '좁은 창인데 스텝 목록이 접혀 있지 않다');
      await app.openStepList();
      check(await app.onTop('step-list-toggle'), '스텝 목록 닫기 단추가 다른 요소에 가려져 있다');
    },
  },
  {
    // 지우면 새는 실기 버그: 터치로 스텝 목록 바깥을 눌러 닫으면 그 아래 단추가 함께 눌린다. 덮개가 pointerdown 에서
    // 닫히고(StepSidebar 의 data-sidebar-backdrop), 손을 뗀 뒤 브라우저가 만드는 click 은 덮개가 사라진 자리
    // 아래로 떨어진다 — 실측으로 [보드 설정](fn-court) 대화 상자가 열렸다. 마우스는 click 이 누른 요소를 따라가
    // 이렇게 새지 않으므로 터치에서만 본다.
    title: 'S7c 스텝 목록 바깥 탭이 아래 단추를 누르지 않는다',
    needs: ['touch', 'keyboard'],
    // 2026-11-15 졸업: 덮개는 누르고 뗀 것이 둘 다 덮개일 때 click 에서 닫는다(ui/useBackdropDismiss — Modal 도 같은 판정).
    run: async (app) => {
      await app.placeFromTray('ball', at(0.35, 0.5), { via: 'drag' });
      await app.saveBoardAsDrill();
      await app.openStepList();
      // 바깥 = 덮개가 맨 위인 자리 가운데 [보드 설정] 단추 바로 위
      const under = await app.centerOf('fn-court');
      check(under !== null, '[보드 설정] 단추가 화면에 없다');
      check(!(await app.onTop('fn-court')), '스텝 목록 덮개가 [보드 설정] 단추를 덮지 않는다 — 이 시나리오의 전제가 깨졌다');
      await app.tap(under);
      await eventually('스텝 목록이 닫힘', () => app.present('step-card'), false);
      check(!(await app.dialogs()).includes('court-modal'), '바깥을 눌러 닫았는데 아래의 [보드 설정]이 열렸다', await app.dialogs());
    },
  },
]);
