use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::models::{CreateTaskRequest, Task};
use crate::state::AppState;

// ============================================
// GET /tasks - List all tasks
// ============================================

pub async fn list_tasks(State(state): State<AppState>) -> Result<Json<Vec<Task>>, StatusCode> {
    match state.repo.get_tasks().await {
        Ok(tasks) => Ok(Json(tasks)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================
// GET /tasks/:id - Get a single task
// ============================================

pub async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Task>, StatusCode> {
    match state.repo.get_task(&id).await {
        Ok(Some(task)) => Ok(Json(task)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================
// POST /tasks - Create a new task
// ============================================

pub async fn create_task(
    State(state): State<AppState>,
    Json(request): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<Task>), StatusCode> {
    match state.repo.create_task(request).await {
        Ok(task) => Ok((StatusCode::CREATED, Json(task))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================
// PUT /tasks/:id - Update a task
// ============================================

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(task): Json<Task>,
) -> Result<Json<Task>, StatusCode> {
    match state.repo.update_task(&id, task).await {
        Ok(task) => Ok(Json(task)),
        Err(crate::db::DbError::NotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================
// DELETE /tasks/:id - Delete a task
// ============================================

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> StatusCode {
    match state.repo.delete_task(&id).await {
        Ok(()) => StatusCode::NO_CONTENT,
        Err(crate::db::DbError::NotFound) => StatusCode::NOT_FOUND,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
