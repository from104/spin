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
/// deb·rpm 설치본과 `cargo run` 은 GDK_BACKEND 를 건드리지 않아 웨일랜드로 정상 기동하므로
/// 이 경로에서만 발동한다. 조건을 좁게 잡은 이유가 그것이다 — 멀쩡한 경우를 건드리지 않는다.
///
/// 대체값으로 `xim` 을 고른 이유: 입력기를 끄면(gtk-im-context-simple) 한국어·일본어 조합
/// 입력이 통째로 죽는다. xim 은 X11 표준 브리지라 XMODIFIERS 가 가리키는 입력기(unim·ibus·
/// fcitx 등)로 그대로 이어진다. XMODIFIERS 조차 없는 환경이라면 이을 곳이 없으니 변수를 지워
/// GTK 가 알아서 고르게 둔다.
///
/// GTK 초기화(=창 생성) 전에 실행돼야 한다. main 첫 줄인 이유다.
#[cfg(target_os = "linux")]
fn fix_appimage_im_module() {
  let backend_is_x11 = std::env::var("GDK_BACKEND")
    .map(|v| v.eq_ignore_ascii_case("x11"))
    .unwrap_or(false);
  let im_is_wayland = std::env::var("GTK_IM_MODULE")
    .map(|v| v.eq_ignore_ascii_case("wayland"))
    .unwrap_or(false);

  if !(backend_is_x11 && im_is_wayland) {
    return;
  }

  let has_xmodifiers = std::env::var("XMODIFIERS")
    .map(|v| v.contains("@im="))
    .unwrap_or(false);

  if has_xmodifiers {
    std::env::set_var("GTK_IM_MODULE", "xim");
  } else {
    std::env::remove_var("GTK_IM_MODULE");
  }
}

fn main() {
  #[cfg(target_os = "linux")]
  fix_appimage_im_module();

  spin_lib::run();
}
