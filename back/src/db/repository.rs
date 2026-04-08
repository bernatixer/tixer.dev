use async_trait::async_trait;

use crate::db::DbError;
use crate::models::{CreateTagRequest, CreateTaskRequest, Tag, Task};

/// Repository trait for task persistence.
///
/// This abstraction allows swapping database backends (SQLite, PostgreSQL, D1, etc.)
/// without changing the application logic.
///
/// All methods require a `user_id` parameter to scope tasks to individual users.
#[async_trait]
pub trait TaskRepository: Send + Sync {
    /// Get all tasks for a user
    async fn get_tasks(&self, user_id: &str) -> Result<Vec<Task>, DbError>;

    /// Get a single task by ID (only if owned by user)
    async fn get_task(&self, user_id: &str, id: &str) -> Result<Option<Task>, DbError>;

    /// Create a new task for a user
    async fn create_task(&self, user_id: &str, request: CreateTaskRequest)
    -> Result<Task, DbError>;

    /// Get all tags for a user
    async fn get_tags(&self, user_id: &str) -> Result<Vec<Tag>, DbError>;

    /// Create a new tag for a user
    async fn create_tag(&self, user_id: &str, request: CreateTagRequest) -> Result<Tag, DbError>;

    /// Update an existing task (only if owned by user)
    async fn update_task(&self, user_id: &str, id: &str, task: Task) -> Result<Task, DbError>;

    /// Delete a task by ID (only if owned by user)
    async fn delete_task(&self, user_id: &str, id: &str) -> Result<(), DbError>;
}
