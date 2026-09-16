//! 네이티브 **저장 대화상자**. 웹에서는 `<a download>` 가 브라우저의 다운로드 기능을 빌려
//! 쓰지만, 데스크톱 웹뷰에는 빌릴 브라우저가 없다 — 눌러도 아무 일도 일어나지 않거나 어디에
//! 저장됐는지 알 수 없다(2026-09-13 기현님 실기). 그래서 파일을 내보내는 모든 길(영상·그림·
//! ZIP·백업·드릴/세션/팀 파일)이 이 명령 하나로 모인다.
//!
//! 왜 `tauri-plugin-fs` 를 쓰지 않나: 그쪽은 **자바스크립트에 파일 쓰기 권한**을 열어 주는
//! 물건이라 capability 에 쓰기 범위를 적어야 하고, 그 범위는 한 번 열면 앱의 모든 코드에
//! 열린다. 여기서 필요한 것은 "사람이 대화상자에서 고른 그 파일 한 개" 뿐이므로, 고르는 일과
//! 쓰는 일을 **러스트 안에서 붙여** 둔다. 웹뷰가 받는 권한은 0 이다.

use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

/// 헤더로 온 파일명을 되돌린다. HTTP 헤더 값은 ASCII 만 담을 수 있는데 드릴 제목에는 한글이
/// 흔하므로, 웹 쪽이 `encodeURIComponent` 로 싸서 보낸다. 되돌릴 수 없는 바이트열이면 이름을
/// 통째로 버린다 — 깨진 이름으로 저장하느니 기본값이 낫다.
fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = bytes.get(i + 1..i + 3)?;
            let s = std::str::from_utf8(hex).ok()?;
            out.push(u8::from_str_radix(s, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// 확장자로 거르개 한 벌을 만든다. 이름이 `SPIN_drill_….spin.json` 처럼 두 겹이어도 마지막
/// 조각만 본다 — 대화상자가 거르개에 쓰는 것은 마지막 확장자다.
fn filter_for(filename: &str) -> (String, String) {
    // 점이 없으면 확장자가 **없는** 것이다 — `rsplit` 은 이름 전체를 돌려주므로 먼저 가른다.
    let ext = match filename.rsplit_once('.') {
        Some((_, e)) => e.to_ascii_lowercase(),
        None => String::new(),
    };
    let label = match ext.as_str() {
        "mp4" => "MP4",
        "png" => "PNG",
        "zip" => "ZIP",
        "json" => "JSON",
        _ => "File",
    };
    (label.to_string(), ext)
}

/// 저장 대화상자를 띄우고, 고른 자리에 바이트를 쓴다.
///
/// 돌려주는 값: `true` = 저장했다, `false` = **사람이 취소했다**(오류가 아니다 — 부르는 쪽이
/// 시트를 닫지 않는 근거로 쓴다). 오류는 진짜 실패(쓰기 실패)일 때만이다.
///
/// ⚠️ 인자를 `Vec<u8>` 로 받지 않는 이유: Tauri 의 `invoke` 는 인자 **묶음** 안의 바이트열을
/// 날바디로 보내지 못한다(`InvokeArgs` 가 `ArrayBuffer | Uint8Array` **통째**만 허용한다).
/// 필드로 받으면 2MB 영상이 200만 개짜리 JSON 숫자 배열이 된다. 그래서 바이트는 날바디로,
/// 파일명은 헤더로 온다.
#[tauri::command]
pub async fn save_bytes_dialog(app: tauri::AppHandle, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let filename = request
        .headers()
        .get("x-spin-filename")
        .and_then(|v| v.to_str().ok())
        .and_then(percent_decode)
        .unwrap_or_else(|| "spin".to_string());

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.clone(),
        tauri::ipc::InvokeBody::Json(_) => return Err("save_bytes_dialog: 날바디가 아니다".into()),
    };

    // ⚠️ `blocking_save_file` 은 **주 스레드에서 부르면 안 된다**(GTK 대화상자를 주 스레드로
    // 보내 놓고 그 자리에서 기다리므로 교착한다). 명령이 async 라 워커에서 돌지만, 그것에
    // 기대지 않고 `spawn_blocking` 으로 못을 박는다.
    let handle = tauri::async_runtime::spawn_blocking(move || {
        let (label, ext) = filter_for(&filename);
        let mut builder = app.dialog().file().set_file_name(&filename);
        // 시작 자리는 **홈 폴더**다(기현님 지시 2026-09-13). 이것을 정해 주지 않으면 GTK 는 앱이
        // 뜬 자리(리눅스에서는 `/` 이거나 AppImage 를 띄운 자리)에서 시작해, 저장하려던 사람이
        // 제 폴더를 찾아 올라가야 한다. 홈을 못 찾는 기계에서는 그냥 대화상자에 맡긴다.
        if let Ok(home) = app.path().home_dir() {
            builder = builder.set_directory(home);
        }
        // 확장자가 없으면 거르개를 걸지 않는다 — 빈 확장자 거르개는 대화상자가 아무 파일도 못 보게 만든다.
        if !ext.is_empty() {
            builder = builder.add_filter(label, &[ext.as_str()]);
        }
        let picked = builder.blocking_save_file();

        let Some(path) = picked else { return Ok(false) };
        let path = path.into_path().map_err(|e| e.to_string())?;
        std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        Ok(true)
    });

    handle.await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    // 드릴 제목은 한글이 기본이다 — 이 한 줄이 틀리면 저장 대화상자의 이름칸이 통째로 깨진다.
    #[test]
    fn percent_decode_restores_korean() {
        assert_eq!(
            percent_decode("SPIN_%EB%93%9C%EB%A6%B4.mp4").as_deref(),
            Some("SPIN_드릴.mp4")
        );
        assert_eq!(percent_decode("plain.mp4").as_deref(), Some("plain.mp4"));
    }

    // 잘린 escape 나 UTF-8 이 아닌 바이트열은 이름을 버리고 기본값으로 간다(패닉이 아니다).
    #[test]
    fn percent_decode_rejects_broken_input() {
        assert_eq!(percent_decode("bad%"), None);
        assert_eq!(percent_decode("bad%zz"), None);
        assert_eq!(percent_decode("%FF%FE"), None);
    }

    // `.spin.json` 처럼 두 겹인 이름도 마지막 조각만 거르개가 된다.
    #[test]
    fn filter_uses_last_extension() {
        assert_eq!(
            filter_for("SPIN_drill.spin.json"),
            ("JSON".to_string(), "json".to_string())
        );
        assert_eq!(filter_for("clip.MP4"), ("MP4".to_string(), "mp4".to_string()));
        assert_eq!(filter_for("noext"), ("File".to_string(), String::new()));
    }
}
