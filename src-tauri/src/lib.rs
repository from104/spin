mod oauth;
mod save_file;
mod secret_store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 기본 브라우저로 구글 로그인을 내보내는 데 쓴다(데스크톱 OAuth). 웹뷰 안에서는
    // 팝업이 안 열리고 origin 도 등록할 수 없다 — 근거는 oauth.rs 머리말.
    .plugin(tauri_plugin_opener::init())
    // 저장 대화상자. 웹뷰에는 권한을 열지 않고 러스트 명령 하나(save_bytes_dialog)로만 쓴다.
    .plugin(tauri_plugin_dialog::init())
    // 자동 업데이트(2026-09-16). 덮는 것은 **AppImage · MSI · macOS 앱 묶음** 셋이다 —
    // deb·rpm·snap 은 패키지 관리자와 스토어가 지는 영역이라 앱이 자기를 바꾸면 안 된다
    // (snap 은 confinement 가 아예 막는다). 무엇을 받을지는 `latest.json` 이 정한다.
    .plugin(tauri_plugin_updater::Builder::new().build())
    // 업데이트를 설치한 뒤 앱을 다시 여는 데만 쓴다(`relaunch`).
    .plugin(tauri_plugin_process::init())
    // 로그인 한 번의 수명만 사는 루프백 수신기의 자리.
    .manage(oauth::OauthState::default())
    .invoke_handler(tauri::generate_handler![
      oauth::oauth_start,
      oauth::oauth_wait,
      oauth::oauth_cancel,
      secret_store::secret_save,
      secret_store::secret_load,
      secret_store::secret_clear,
      save_file::save_bytes_dialog,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
