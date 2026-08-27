// 데스크톱 구글 로그인의 **받는 쪽** — 127.0.0.1 루프백 한 번짜리 HTTP 수신기.
//
// ── 왜 이게 필요한가 (2026-08-27 실측) ────────────────────────────────────────────────
// 웹앱은 GIS(`accounts.google.com/gsi/client`)로 팝업을 띄워 토큰을 받는다. 데스크톱 웹뷰에서
// 그 길은 **두 겹으로 막혀 있다**:
//   ① `Failed to open popup window` — Tauri 웹뷰가 window.open 을 안 띄운다. 여기서 이미 끝난다.
//   ② 팝업이 열렸어도 `origin=tauri://localhost` 다 — 구글 콘솔의 '승인된 JavaScript 원본' 은
//      http/https 만 받으므로 등록할 방법이 자체가 없다.
// 그래서 데스크톱은 **설치형 앱 흐름**(RFC 8252)으로 간다: 기본 브라우저에서 로그인시키고,
// 리다이렉트를 이 프로세스가 연 루프백 포트로 받는다. 구글 콘솔의 '데스크톱 앱' 클라이언트는
// `http://127.0.0.1:<아무 포트>` 리다이렉트를 별도 등록 없이 허용한다 — 그것이 이 유형의 정의다.
//
// ── 설계 ─────────────────────────────────────────────────────────────────────────────
// · 포트는 **0 으로 바인딩해 OS 가 고르게 한다.** 고정 포트는 이미 쓰는 프로그램이 있으면
//   충돌하고, 그 충돌이 하필 체육관에서 나면 손쓸 방법이 없다. 고른 포트를 프런트에 돌려주면
//   프런트가 그것으로 redirect_uri 를 만든다.
// · 요청을 **한 번만** 받고 닫는다. 이 리스너는 로그인 한 번의 수명만 산다 — 계속 열어 두면
//   그 자체가 로컬 공격면이다.
// · `state` 대조는 프런트가 한다(여기서는 쿼리를 그대로 넘긴다). 값을 만든 쪽이 검사해야
//   양쪽에 같은 상수를 두 번 적는 일이 없다.
// · 브라우저에는 **완결된 안내 페이지**를 돌려준다. 여기서 아무것도 안 보내면 사용자는
//   빈 화면이나 '연결할 수 없음' 을 보게 되고, 그러면 성공했는지 알 수가 없다.
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::Mutex;
use std::time::Duration;

/// 사용자가 브라우저에서 계정을 고르고 동의를 읽는 시간. 넉넉해야 한다 — 여기서 끊기면
/// 사용자는 로그인을 마쳤는데 앱은 실패로 아는, 가장 설명하기 어려운 상태가 된다.
const WAIT_TIMEOUT: Duration = Duration::from_secs(300);

/// 요청 첫 줄(`GET /?code=... HTTP/1.1`)만 읽는다. 헤더·본문은 볼 이유가 없고, 무제한으로
/// 읽으면 그것이 곧 DoS 통로다.
const MAX_REQUEST_LINE: u64 = 8 * 1024;

#[derive(Default)]
pub struct OauthState {
  /// 한 번에 한 로그인만 산다. 새 로그인이 시작되면 앞의 것은 그대로 버려진다(리스너는
  /// 스레드가 끝나며 닫힌다).
  pending: Mutex<Option<Receiver<Result<String, String>>>>,
}

/// 브라우저가 리다이렉트를 따라온 뒤 **사람이 보는 화면**. 앱으로 돌아가라고 말해 주는 것이
/// 이 페이지가 하는 일의 전부다.
fn done_page(ok: bool) -> String {
  let (title, body) = if ok {
    ("연결됐습니다", "이 탭을 닫고 SPIN 으로 돌아가세요.")
  } else {
    ("연결하지 못했습니다", "이 탭을 닫고 SPIN 에서 다시 시도하세요.")
  };
  let html = format!(
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">\
     <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>SPIN — {title}</title></head>\
     <body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;\
     background:#0d1117;color:#e6edf3;font:16px/1.6 system-ui,sans-serif\">\
     <main style=\"text-align:center;padding:24px\"><h1 style=\"font-size:20px;margin:0 0 8px\">{title}</h1>\
     <p style=\"margin:0;color:#9aa4b2\">{body}</p></main></body></html>"
  );
  format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
    html.len(),
    html
  )
}

/// `GET /?code=x&state=y HTTP/1.1` → `"code=x&state=y"`. 쿼리 해석은 프런트가 한다.
fn query_of(request_line: &str) -> Option<String> {
  let path = request_line.split_whitespace().nth(1)?;
  let (_, query) = path.split_once('?')?;
  Some(query.to_string())
}

/// 루프백 수신기를 연다. 돌려주는 것은 **OS 가 고른 포트**이고, 프런트는 그것으로
/// `http://127.0.0.1:<port>` redirect_uri 를 만든다.
#[tauri::command]
pub fn oauth_start(state: tauri::State<'_, OauthState>) -> Result<u16, String> {
  // 127.0.0.1 이다 — `0.0.0.0` 으로 열면 같은 LAN 의 누구든 인증 코드를 가로챌 수 있다.
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| format!("루프백 포트를 열 수 없습니다: {e}"))?;
  let port = listener.local_addr().map_err(|e| format!("포트를 알 수 없습니다: {e}"))?.port();

  let (tx, rx) = mpsc::channel();
  std::thread::spawn(move || {
    // 한 번만 받는다. accept 가 실패하면 그 사유를 그대로 올려 보낸다.
    let result = match listener.accept() {
      Ok((mut stream, _)) => {
        let mut line = String::new();
        let read = BufReader::new(&stream).take(MAX_REQUEST_LINE).read_line(&mut line);
        let outcome = match read {
          Ok(_) => query_of(&line).ok_or_else(|| "리다이렉트에 쿼리가 없습니다".to_string()),
          Err(e) => Err(format!("요청을 읽지 못했습니다: {e}")),
        };
        // 응답은 성패와 무관하게 보낸다 — 안 보내면 브라우저에 오류 화면이 남는다.
        let _ = stream.write_all(done_page(outcome.is_ok()).as_bytes());
        let _ = stream.flush();
        outcome
      }
      Err(e) => Err(format!("연결을 받지 못했습니다: {e}")),
    };
    // 프런트가 이미 떠났으면(창을 닫았거나 취소) 받을 사람이 없다 — 조용히 버린다.
    let _ = tx.send(result);
  });

  *state.pending.lock().map_err(|_| "인증 상태가 손상됐습니다".to_string())? = Some(rx);
  Ok(port)
}

/// 브라우저가 리다이렉트를 따라올 때까지 기다렸다가 **쿼리 문자열**을 돌려준다.
/// 해석(code·state·error)은 프런트 몫이다.
#[tauri::command]
pub async fn oauth_wait(state: tauri::State<'_, OauthState>) -> Result<String, String> {
  // 채널을 꺼내 온다 — 기다리는 동안 잠금을 쥐고 있으면 취소·재시도가 막힌다.
  let rx = {
    let mut slot = state.pending.lock().map_err(|_| "인증 상태가 손상됐습니다".to_string())?;
    slot.take().ok_or_else(|| "시작되지 않은 인증입니다".to_string())?
  };
  // blocking recv 를 async 런타임에서 그대로 돌리면 런타임이 5분간 막힌다.
  tauri::async_runtime::spawn_blocking(move || match rx.recv_timeout(WAIT_TIMEOUT) {
    Ok(result) => result,
    Err(RecvTimeoutError::Timeout) => Err("시간이 초과됐습니다".to_string()),
    Err(RecvTimeoutError::Disconnected) => Err("인증이 중단됐습니다".to_string()),
  })
  .await
  .map_err(|e| format!("인증 대기가 실패했습니다: {e}"))?
}

/// 진행 중인 로그인을 버린다(사용자가 취소한 경우). 리스너 스레드는 accept 에서 계속
/// 기다리다가 프로세스와 함께 사라진다 — 채널만 놓으면 프런트 쪽 계약은 끝난다.
#[tauri::command]
pub fn oauth_cancel(state: tauri::State<'_, OauthState>) -> Result<(), String> {
  *state.pending.lock().map_err(|_| "인증 상태가 손상됐습니다".to_string())? = None;
  Ok(())
}

// `take()` 를 쓰기 위한 것. BufRead 를 쓰는 자리에서만 필요하다.
use std::io::Read;
