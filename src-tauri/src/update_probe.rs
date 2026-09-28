use serde::Serialize;
use std::time::Duration;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestProbe {
    endpoint: String,
    status: Option<u16>,
    repository_status: Option<u16>,
    body: Option<String>,
    error: Option<String>,
    category: Option<&'static str>,
}

/// Transport diagnostics only. The official updater remains solely responsible
/// for version selection, downloading and cryptographic signature verification.
#[tauri::command]
pub async fn probe_update_manifest(window: tauri::WebviewWindow) -> Result<ManifestProbe, String> {
    if window.label() != "main" { return Err("Updater diagnostics are main-window only".into()); }
    let config = window.config();
    let endpoint = config.plugins.0.get("updater")
        .and_then(|value| value.get("endpoints"))
        .and_then(|value| value.get(0)).and_then(|value| value.as_str())
        .ok_or("Updater endpoint is not configured")?.to_string();
    let mut result = ManifestProbe { endpoint: endpoint.clone(), status: None, repository_status: None, body: None, error: None, category: None };
    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).user_agent("Shunhen-Updater").build().map_err(|e| e.to_string())?;
    match client.get(&endpoint).header("Accept", "application/json").send().await {
        Ok(response) => {
            result.status = Some(response.status().as_u16());
            if response.status().is_success() {
                match response.text().await {
                    Ok(body) if body.len() <= 1_048_576 => result.body = Some(body),
                    Ok(_) => { result.category = Some("malformed-manifest"); result.error = Some("Manifest exceeds size limit".into()); },
                    Err(error) => { result.category = Some(if error.is_timeout() { "timeout" } else { "network" }); result.error = Some(error.to_string()); },
                }
            } else if response.status().as_u16() == 404 {
                // GitHub also returns 404 for private repositories. Do not label
                // an inaccessible repository as merely missing latest.json.
                if let Ok(url) = reqwest::Url::parse(&endpoint) {
                    let parts: Vec<_> = url.path().trim_matches('/').split('/').collect();
                    if url.host_str() == Some("github.com") && parts.len() >= 2 {
                        let repository = format!("https://github.com/{}/{}", parts[0], parts[1]);
                        result.repository_status = client.get(repository).send().await.ok().map(|response| response.status().as_u16());
                    }
                }
            }
        }
        Err(error) => { result.category = Some(if error.is_timeout() { "timeout" } else { "network" }); result.error = Some(error.to_string()); },
    }
    Ok(result)
}
