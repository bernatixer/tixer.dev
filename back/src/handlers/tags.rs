use axum::{Json, extract::{Path, State}, http::StatusCode};

use crate::auth::AuthUser;
use crate::handlers::tasks::AppError;
use crate::models::{CreateTagRequest, Tag};
use crate::state::AppState;

pub async fn list_tags(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Tag>>, AppError> {
    state
        .repo
        .get_tags(&auth.user_id)
        .await
        .map(Json)
        .map_err(|e| {
            AppError(
                format!("DB error: {}", e),
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        })
}

pub async fn create_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(request): Json<CreateTagRequest>,
) -> Result<(StatusCode, Json<Tag>), AppError> {
    state
        .repo
        .create_tag(&auth.user_id, request)
        .await
        .map(|tag| (StatusCode::CREATED, Json(tag)))
        .map_err(|e| {
            AppError(
                format!("DB error: {}", e),
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        })
}

pub async fn delete_tag(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    state
        .repo
        .delete_tag(&auth.user_id, &id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| {
            AppError(
                format!("DB error: {}", e),
                StatusCode::INTERNAL_SERVER_ERROR,
            )
        })
}
