// 갱신 토큰(refresh token)을 두는 자리.
//
// ── 왜 웹뷰가 아니라 여기인가 ────────────────────────────────────────────────────────
// 갱신 토큰은 **만료가 없는 열쇠**다. 그것 하나면 언제든 새 접근 토큰을 만들어 사용자의
// Drive 앱 폴더를 읽고 쓸 수 있다. 웹앱은 애초에 이 토큰을 안 받는다(GIS 는 접근 토큰만
// 준다) — 데스크톱 흐름에서 처음 생기는 물건이라, 둘 자리도 여기서 처음 정한다.
//
// `localStorage` 에 두지 않는 이유: 그 저장소는 페이지 스크립트라면 무엇이든 읽는다. 지금
// 앱에 외부 스크립트가 하나 있고(구글 GIS), 앞으로도 없으리라는 보장은 못 한다. 파일로
// 내려두면 최소한 **웹 문맥에서는 못 읽는다** — 커맨드를 거쳐야만 닿는다.
//
// ⚠️ 이것은 암호화가 아니다. 같은 사용자로 로그인한 프로세스는 이 파일을 읽을 수 있다.
//    OS 키체인(libsecret·Keychain·DPAPI)까지 가는 것이 다음 칸이고, 그 전까지는 **파일
//    권한이 유일한 방벽**이라 0600 을 반드시 건다. 값 자체는 어디에도 로그로 남기지 않는다.
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 파일 하나에 토큰 하나. 형식을 두지 않는 이유는 늘릴 계획이 없기 때문이다 — 늘려야 하면
/// 그때는 JSON 으로 바꾸고 마이그레이션을 적는다.
const FILE: &str = "google-refresh-token";

fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("앱 데이터 폴더를 찾을 수 없습니다: {e}"))?;
  fs::create_dir_all(&dir).map_err(|e| format!("앱 데이터 폴더를 만들 수 없습니다: {e}"))?;
  Ok(dir.join(FILE))
}

/// 파일을 **소유자만** 읽고 쓸 수 있게 한다. 유닉스가 아니면 조용히 건너뛴다 —
/// 윈도우는 앱 데이터 폴더 자체가 사용자 단위로 갈려 있다.
#[cfg(unix)]
fn lock_down(p: &PathBuf) -> Result<(), String> {
  use std::os::unix::fs::PermissionsExt;
  fs::set_permissions(p, fs::Permissions::from_mode(0o600)).map_err(|e| format!("파일 권한을 설정하지 못했습니다: {e}"))
}
#[cfg(not(unix))]
fn lock_down(_p: &PathBuf) -> Result<(), String> {
  Ok(())
}

#[tauri::command]
pub fn secret_save(app: tauri::AppHandle, value: String) -> Result<(), String> {
  let p = path(&app)?;
  fs::write(&p, value.as_bytes()).map_err(|e| format!("토큰을 저장하지 못했습니다: {e}"))?;
  // 쓰고 나서 조인다. 만들 때부터 0600 이려면 OpenOptions.mode 가 필요한데, 그 경로는
  // 유닉스 전용이라 분기가 하나 더 생긴다 — 여기서는 만든 직후 조이는 것으로 충분하다
  // (그 사이에 읽으려면 같은 사용자여야 하고, 그러면 어차피 읽을 수 있다).
  lock_down(&p)
}

/// 없으면 `None` 이다 — **오류가 아니다.** 연결한 적이 없는 상태가 정상이다.
#[tauri::command]
pub fn secret_load(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let p = path(&app)?;
  match fs::read_to_string(&p) {
    Ok(s) => Ok(Some(s)),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
    Err(e) => Err(format!("토큰을 읽지 못했습니다: {e}")),
  }
}

/// [연결 해제]. 없는 파일을 지우는 것도 성공이다 — 호출자가 "이미 없음" 과 "지웠음" 을
/// 가를 이유가 없다.
#[tauri::command]
pub fn secret_clear(app: tauri::AppHandle) -> Result<(), String> {
  let p = path(&app)?;
  match fs::remove_file(&p) {
    Ok(()) => Ok(()),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
    Err(e) => Err(format!("토큰을 지우지 못했습니다: {e}")),
  }
}
