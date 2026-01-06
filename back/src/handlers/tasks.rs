use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::auth::AuthUser;
use crate::models::{CreateTaskRequest, Task};
use crate::state::AppState;

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

pub struct AppError(String, StatusCode);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.1, Json(ErrorResponse { error: self.0 })).into_response()
    }
}

// ============================================
// GET /tasks - List all tasks for authenticated user
// ============================================

pub async fn list_tasks(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<Task>>, AppError> {
    state.repo.get_tasks(&auth.user_id).await
        .map(Json)
        .map_err(|e| AppError(format!("DB error: {}", e), StatusCode::INTERNAL_SERVER_ERROR))
}

// ============================================
// GET /tasks/:id - Get a single task (if owned by user)
// ============================================

pub async fn get_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Task>, AppError> {
    match state.repo.get_task(&auth.user_id, &id).await {
        Ok(Some(task)) => Ok(Json(task)),
        Ok(None) => Err(AppError("Task not found".into(), StatusCode::NOT_FOUND)),
        Err(e) => Err(AppError(format!("DB error: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============================================
// POST /tasks - Create a new task for authenticated user
// ============================================

pub async fn create_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), AppError> {
    state.repo.create_task(&auth.user_id, request).await
        .map(|task| (StatusCode::CREATED, Json(task)))
        .map_err(|e| AppError(format!("DB error: {}", e), StatusCode::INTERNAL_SERVER_ERROR))
}

// ============================================
// PUT /tasks/:id - Update a task (if owned by user)
// ============================================

pub async fn update_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(task): Json<Task>,
) -> Result<Json<Task>, AppError> {
    match state.repo.update_task(&auth.user_id, &id, task).await {
        Ok(task) => Ok(Json(task)),
        Err(crate::db::DbError::NotFound) => Err(AppError("Task not found".into(), StatusCode::NOT_FOUND)),
        Err(e) => Err(AppError(format!("DB error: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============================================
// DELETE /tasks/:id - Delete a task (if owned by user)
// ============================================

pub async fn delete_task(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    match state.repo.delete_task(&auth.user_id, &id).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(crate::db::DbError::NotFound) => Err(AppError("Task not found".into(), StatusCode::NOT_FOUND)),
        Err(e) => Err(AppError(format!("DB error: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}
