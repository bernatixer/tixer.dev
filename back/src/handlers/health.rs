use axum::Json;
use serde::Serialize;
use std::env;

#[derive(Serialize)]
pub struct HealthResponse {
    status: String,
    version: String,
}

#[derive(Serialize)]
pub struct DebugResponse {
    pem_key_set: bool,
    pem_key_len: usize,
    issuer_url: Option<String>,
}

pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub async fn debug() -> Json<DebugResponse> {
    let pem = env::var("CLERK_PEM_PUBLIC_KEY").unwrap_or_default();
    Json(DebugResponse {
        pem_key_set: !pem.is_empty(),
        pem_key_len: pem.len(),
        issuer_url: env::var("CLERK_ISSUER_URL").ok(),
    })
}

