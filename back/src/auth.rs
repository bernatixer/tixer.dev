use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::env;

// ============================================
// PUBLIC KEY
// ============================================

/// Cached decoding key from PEM
static DECODING_KEY: OnceCell<DecodingKey> = OnceCell::new();

/// Get or initialize the decoding key from the CLERK_PEM_PUBLIC_KEY env var
fn get_decoding_key() -> Result<&'static DecodingKey, AuthError> {
    DECODING_KEY.get_or_try_init(|| {
        let pem = env::var("CLERK_PEM_PUBLIC_KEY")
            .map_err(|_| AuthError::Configuration("CLERK_PEM_PUBLIC_KEY not set".to_string()))?;
        
        // Handle escaped newlines from .env file
        let pem = pem.replace("\\n", "\n");
        
        DecodingKey::from_rsa_pem(pem.as_bytes())
            .map_err(|e| AuthError::Configuration(format!("Invalid PEM key: {}", e)))
    })
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
    #[error("Configuration error: {0}")]
    Configuration(String),
}

/// JSON error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let status = match &self {
            AuthError::MissingHeader | AuthError::InvalidHeaderFormat => StatusCode::UNAUTHORIZED,
            AuthError::InvalidToken(_) => StatusCode::UNAUTHORIZED,
            AuthError::Configuration(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let body = Json(ErrorResponse { error: self.to_string() });
        (status, body).into_response()
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract the Authorization header
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .ok_or(AuthError::MissingHeader)?;

        // Check for Bearer prefix
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidHeaderFormat)?;

        // Get the decoding key from PEM
        let decoding_key = get_decoding_key()?;

        // Set up validation
        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_aud = false;
        
        // Validate issuer if CLERK_ISSUER_URL is set
        if let Ok(issuer_url) = env::var("CLERK_ISSUER_URL") {
            validation.set_issuer(&[issuer_url]);
        }

        // Decode and validate the token
        let token_data = decode::<Claims>(token, decoding_key, &validation)
            .map_err(|e| AuthError::InvalidToken(format!("{:?}", e)))?;

        Ok(AuthUser {
            user_id: token_data.claims.sub,
        })
    }
}
