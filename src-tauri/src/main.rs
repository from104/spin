// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// AppImage 안에서만 터지는 사고를 막는다.
///
/// linuxdeploy 가 자동 생성하는 AppRun 은 `GDK_BACKEND=x11` 을 **무조건** 박아 넣는다
/// (Tauri #8541 — 웨일랜드 백엔드에서 크래시하던 것을 피하려고). 그런데 웨일랜드 세션의
/// 데스크톱 환경은 `GTK_IM_MODULE=wayland` 를 내보내 두므로, 이 둘이 만나면
/// **X11 디스플레이 위에서 웨일랜드 전용 입력기 모듈이 로드된다.** im-wayland.so 는
/// `gdk_wayland_display_get_wl_display()` 로 wl_display 를 요구하고, X11 디스플레이가
/// 넘어오면 assertion 이 깨진 채 그대로 널 포인터를 타 SIGSEGV 로 죽는다.
/// 창이 뜨기도 전에, 스택은 wry 의 set_webview_settings 안이다.
///
/// 고치는 방향을 한 번 틀었다. 처음에는 입력기 쪽을 X11 에 맞춰(`xim`) 봤는데,
/// **xim 브리지가 입력기와 물리면 창이 통째로 얼었다**(2026-08-25 기현님 실기, unim).
/// xim 은 동기 프로토콜이라 웹뷰가 있는 구성에서 쉽게 물린다 — 죽지만 않을 뿐 더 나쁘다.
/// 그래서 반대로 **디스플레이 백엔드를 세션에 맞춘다.** deb·rpm 설치본과 `tauri:dev` 는
/// GDK_BACKEND 를 건드리지 않아 웨일랜드로 멀쩡히 돌고 있으므로, AppImage 를 그 검증된
/// 조건으로 되돌리는 것이다. 백엔드가 웨일랜드면 im-wayland 도 제 짝을 만나 정합이 맞는다.
///
/// 조건을 좁게 잡은 이유: AppImage 로 실행됐고(APPDIR), 세션이 실제로 웨일랜드일 때만이다.
/// X11 세션에서 AppImage 를 돌리면 AppRun 의 x11 강제가 옳으므로 그대로 둔다.
///
/// ── ⚠️ 2026-09-05: 위 문단의 "웨일랜드 세션일 때만" 을 넓혔다 ──────────────
/// 감사(docs/AUDIT-DESKTOP-MERGE-2026-09-05.md [중 4])가 `WAYLAND_DISPLAY` 는 **대리변수**
/// 이지 방아쇠가 아님을 실증했다. 방아쇠는 `GDK_BACKEND=x11` + `GTK_IM_MODULE=wayland` 의
/// **쌍**이고, 이 쌍은 `WAYLAND_DISPLAY` 없이도 성립한다 — systemd 유저 유닛이나 일부 런처는
/// 환경을 좁혀서 넘기기 때문이다. 출시된 AppImage 를 `env -u WAYLAND_DISPLAY` 로 띄우면
/// 지금도 exit 139(SIGSEGV) 로 죽는 것으로 재현했다. 그래서 그 맥락에서는 쌍을 **반대편에서**
/// 끊는다: GDK_BACKEND 를 지워도 웨일랜드로 갈 근거(WAYLAND_DISPLAY)가 없으니, 대신
/// `GTK_IM_MODULE` 을 지운다. 앱은 x11 로 뜨고 입력기는 GTK 기본으로 떨어질 수 있지만 죽지는
/// 않는다 — 위 xim 문단대로 **`GTK_IM_MODULE=xim` 을 대신 넣지는 않는다.**
/// 웨일랜드 세션(검증된 경로)의 처리는 한 글자도 바꾸지 않았다.
///
/// 탈출구: `SPIN_FORCE_X11=1` 이면 GDK_BACKEND 를 건드리지 않는다. Tauri #8541(웨일랜드
/// 백엔드 크래시)이 재발하면 사용자가 x11 로 되돌릴 길이 하나도 없었기 때문이다. 그때
/// `GTK_IM_MODULE=wayland` 는 **백엔드가 실제로 x11 로 강제돼 있을 때만** 지운다 — 그 쌍이 곧
/// 위에서 말한 크래시라서다. AppImage 밖(deb·rpm·dev)에서는 GDK_BACKEND 가 x11 이 아니므로
/// 이 변수를 줘도 아무것도 안 바뀐다. (⚠️ 첫 판은 x11 여부를 안 보고 IM 만 뗐다 — 웨일랜드로
/// 뜨는 판에서 얻는 것 없이 한글 입력만 죽는다. 2026-09-05 검수에서 잡혀 고쳤다.)
///
/// AppImage 밖에서 사용자가 **직접** `GDK_BACKEND=x11` 을 준 경우도 같은 쌍이 성립한다. 백엔드
/// 선택은 그의 것이니 되돌리지 않고 IM 쪽만 뗀다.
///
/// GTK 초기화(=창 생성) 전에 실행돼야 한다. main 첫 줄인 이유다.
/// 판정은 환경을 읽지 않는 순수 함수 `plan()` 에 떼어 뒀다 — 부작용(remove_var)은
/// `fix_appimage_display_backend()` 한 곳에만 있다. 환경변수는 프로세스 전역이라 러스트
/// 단위 테스트(병렬 실행)로는 못 재지만, 순수 함수 쪽은 나중에 테스트를 붙일 수 있다.
#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Plan {
  /// 손대지 않는다.
  LeaveAsIs,
  /// GDK_BACKEND 를 지운다 — 백엔드를 세션(웨일랜드)에 맞춘다. 검증된 경로.
  ClearGdkBackend,
  /// GTK_IM_MODULE 을 지운다 — x11 위에 얹힌 웨일랜드 입력기를 떼어 낸다.
  ClearGtkImModule,
}

#[cfg(target_os = "linux")]
fn plan(appdir: bool, wayland: bool, backend_x11: bool, im_wayland: bool, force_x11: bool) -> Plan {
  // 탈출구가 먼저다. 사용자가 x11 을 원한다고 말했으면 백엔드는 그의 것이다.
  if force_x11 {
    // 쌍이 실제로 있을 때만 끊는다. x11 강제가 없는 판에서 IM 만 떼면 한글 입력만 죽는다.
    return if backend_x11 && im_wayland { Plan::ClearGtkImModule } else { Plan::LeaveAsIs };
  }
  if appdir && backend_x11 {
    if wayland {
      return Plan::ClearGdkBackend; // ★ 검증된 경로 — 바꾸지 마라
    }
    if im_wayland {
      return Plan::ClearGtkImModule; // 쌍을 반대편에서 끊는다
    }
    return Plan::LeaveAsIs;
  }
  // AppImage 밖: x11 이면 사용자가 직접 고른 것이다. 그 선택은 두고 쌍이 성립할 때 IM 만 뗀다.
  if backend_x11 && im_wayland {
    return Plan::ClearGtkImModule;
  }
  Plan::LeaveAsIs
}

#[cfg(target_os = "linux")]
fn fix_appimage_display_backend() {
  // AppRun 이 export 하는 변수. AppImage 로 띄웠을 때만 있다.
  let in_appimage = std::env::var_os("APPDIR").is_some();
  let wayland_session = std::env::var_os("WAYLAND_DISPLAY").is_some();
  let backend_forced_x11 = std::env::var("GDK_BACKEND")
    .map(|v| v.eq_ignore_ascii_case("x11"))
    .unwrap_or(false);
  let im_module_wayland = std::env::var("GTK_IM_MODULE")
    .map(|v| v.eq_ignore_ascii_case("wayland"))
    .unwrap_or(false);
  // 값을 "1" 로 좁게 본다 — 빈 문자열이나 켜 둔 흔적으로 백엔드가 바뀌면 안 된다.
  let force_x11 = std::env::var("SPIN_FORCE_X11")
    .map(|v| v == "1")
    .unwrap_or(false);

  match plan(
    in_appimage,
    wayland_session,
    backend_forced_x11,
    im_module_wayland,
    force_x11,
  ) {
    // 지우기만 하면 GDK 가 WAYLAND_DISPLAY 를 보고 알아서 웨일랜드를 고른다.
    Plan::ClearGdkBackend => std::env::remove_var("GDK_BACKEND"),
    Plan::ClearGtkImModule => std::env::remove_var("GTK_IM_MODULE"),
    Plan::LeaveAsIs => {}
  }
}

fn main() {
  #[cfg(target_os = "linux")]
  fix_appimage_display_backend();

  spin_lib::run();
}
