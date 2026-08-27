mod oauth;
mod secret_store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 기본 브라우저로 구글 로그인을 내보내는 데 쓴다(데스크톱 OAuth). 웹뷰 안에서는
    // 팝업이 안 열리고 origin 도 등록할 수 없다 — 근거는 oauth.rs 머리말.
    .plugin(tauri_plugin_opener::init())
    // 로그인 한 번의 수명만 사는 루프백 수신기의 자리.
    .manage(oauth::OauthState::default())
    .invoke_handler(tauri::generate_handler![
      oauth::oauth_start,
      oauth::oauth_wait,
      oauth::oauth_cancel,
      secret_store::secret_save,
      secret_store::secret_load,
      secret_store::secret_clear,
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
