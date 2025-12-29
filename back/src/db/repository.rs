use async_trait::async_trait;

use crate::db::DbError;
use crate::models::{CreateTaskRequest, Task};

/// Repository trait for task persistence.
/// 
/// This abstraction allows swapping database backends (SQLite, PostgreSQL, D1, etc.)
/// without changing the application logic.
#[async_trait]
pub trait TaskRepository: Send + Sync {
    /// Get all tasks
    async fn get_tasks(&self) -> Result<Vec<Task>, DbError>;

    /// Get a single task by ID
    async fn get_task(&self, id: &str) -> Result<Option<Task>, DbError>;

    /// Create a new task
    async fn create_task(&self, request: CreateTaskRequest) -> Result<Task, DbError>;

    /// Update an existing task
    async fn update_task(&self, id: &str, task: Task) -> Result<Task, DbError>;

    /// Delete a task by ID
    async fn delete_task(&self, id: &str) -> Result<(), DbError>;
}

