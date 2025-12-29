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

pub async fn list_tasks(State(state): State<AppState>) -> Json<Vec<Task>> {
    let tasks = state.get_tasks().await;
    Json(tasks)
}

// ============================================
// GET /tasks/:id - Get a single task
// ============================================

pub async fn get_task(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Task>, StatusCode> {
    match state.get_task(&id).await {
        Some(task) => Ok(Json(task)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

// ============================================
// POST /tasks - Create a new task
// ============================================

pub async fn create_task(
    State(state): State<AppState>,
    Json(request): Json<CreateTaskRequest>,
) -> (StatusCode, Json<Task>) {
    let task = state.create_task(request).await;
    (StatusCode::CREATED, Json(task))
}

