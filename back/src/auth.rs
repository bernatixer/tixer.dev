use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use jsonwebtoken::{decode, decode_header, DecodingKey, Validation, Algorithm};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::RwLock;

// ============================================
// JWKS CACHE
// ============================================

/// Cached JWKS keys
static JWKS_CACHE: OnceCell<RwLock<HashMap<String, DecodingKey>>> = OnceCell::new();

/// JWKS response structure from Clerk
#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<JwkKey>,
}

#[derive(Debug, Deserialize)]
struct JwkKey {
    kid: String,
    kty: String,
    n: String,
    e: String,
}

/// Fetch and cache JWKS from Clerk
async fn fetch_jwks() -> Result<(), AuthError> {
    let issuer_url = env::var("CLERK_ISSUER_URL")
        .map_err(|_| AuthError::Configuration("CLERK_ISSUER_URL not set".to_string()))?;
    
    let jwks_url = format!("{}/.well-known/jwks.json", issuer_url);
    
    let response = reqwest::get(&jwks_url)
        .await
        .map_err(|e| AuthError::JwksFetch(e.to_string()))?;
    
    let jwks: JwksResponse = response
        .json()
        .await
        .map_err(|e| AuthError::JwksFetch(e.to_string()))?;
    
    let cache = JWKS_CACHE.get_or_init(|| RwLock::new(HashMap::new()));
    let mut keys = cache.write().map_err(|_| AuthError::JwksFetch("Lock poisoned".to_string()))?;
    
    for key in jwks.keys {
        if key.kty == "RSA" {
            if let Ok(decoding_key) = DecodingKey::from_rsa_components(&key.n, &key.e) {
                keys.insert(key.kid, decoding_key);
            }
        }
    }
    
    Ok(())
}

/// Get a decoding key by kid, fetching JWKS if needed
async fn get_decoding_key(kid: &str) -> Result<DecodingKey, AuthError> {
    // Try to get from cache first
    if let Some(cache) = JWKS_CACHE.get() {
        if let Ok(keys) = cache.read() {
            if let Some(key) = keys.get(kid) {
                return Ok(key.clone());
            }
        }
    }
    
    // Fetch JWKS and try again
    fetch_jwks().await?;
    
    let cache = JWKS_CACHE.get().ok_or(AuthError::JwksFetch("Cache not initialized".to_string()))?;
    let keys = cache.read().map_err(|_| AuthError::JwksFetch("Lock poisoned".to_string()))?;
    
    keys.get(kid)
        .cloned()
        .ok_or(AuthError::InvalidToken("Key not found".to_string()))
}

// ============================================
// JWT CLAIMS
// ============================================

/// JWT claims from Clerk
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Issued at
    pub iat: i64,
    /// Expiration
    pub exp: i64,
    /// Issuer
    pub iss: String,
    /// Audience (optional)
    #[serde(default)]
    pub aud: Option<String>,
}

// ============================================
// AUTH USER EXTRACTOR
// ============================================

/// Authenticated user extracted from JWT
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
}

/// Authentication errors
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Missing authorization header")]
    MissingHeader,
    #[error("Invalid authorization header format")]
    InvalidHeaderFormat,
    #[error("Invalid token: {0}")]
    InvalidToken(String),
    #[error("JWKS fetch error: {0}")]
    JwksFetch(String),
    #[error("Configuration error: {0}")]
    Configuration(String),
}

impl From<AuthError> for StatusCode {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::MissingHeader | AuthError::InvalidHeaderFormat => StatusCode::UNAUTHORIZED,
            AuthError::InvalidToken(_) => StatusCode::UNAUTHORIZED,
            AuthError::JwksFetch(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AuthError::Configuration(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract the Authorization header
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        // Check for Bearer prefix
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;

        // Decode the header to get the kid
        let header = decode_header(token)
            .map_err(|_| StatusCode::UNAUTHORIZED)?;
        
        let kid = header.kid.ok_or(StatusCode::UNAUTHORIZED)?;

        // Get the decoding key
        let decoding_key = get_decoding_key(&kid)
            .await
            .map_err(|e| {
                eprintln!("Auth error: {:?}", e);
                StatusCode::from(e)
            })?;

        // Set up validation
        let issuer_url = env::var("CLERK_ISSUER_URL")
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&issuer_url]);
        // Clerk doesn't always set audience, so we skip validation
        validation.validate_aud = false;

        // Decode and validate the token
        let token_data = decode::<Claims>(token, &decoding_key, &validation)
            .map_err(|e| {
                eprintln!("Token validation error: {:?}", e);
                StatusCode::UNAUTHORIZED
            })?;

        Ok(AuthUser {
            user_id: token_data.claims.sub,
        })
    }
}

