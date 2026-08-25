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
/// GTK 초기화(=창 생성) 전에 실행돼야 한다. main 첫 줄인 이유다.
#[cfg(target_os = "linux")]
fn fix_appimage_display_backend() {
  // AppRun 이 export 하는 변수. AppImage 로 띄웠을 때만 있다.
  let in_appimage = std::env::var_os("APPDIR").is_some();
  let wayland_session = std::env::var_os("WAYLAND_DISPLAY").is_some();
  let backend_forced_x11 = std::env::var("GDK_BACKEND")
    .map(|v| v.eq_ignore_ascii_case("x11"))
    .unwrap_or(false);

  if in_appimage && wayland_session && backend_forced_x11 {
    // 지우기만 하면 GDK 가 WAYLAND_DISPLAY 를 보고 알아서 웨일랜드를 고른다.
    std::env::remove_var("GDK_BACKEND");
  }
}

fn main() {
  #[cfg(target_os = "linux")]
  fix_appimage_display_backend();

  spin_lib::run();
}
