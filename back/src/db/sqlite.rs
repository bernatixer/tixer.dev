use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use uuid::Uuid;

use crate::db::{DbError, TaskRepository};
use crate::models::{BlockedBy, ColumnId, CreateTaskRequest, Priority, Recurrence, Subtask, TagId, Task, TaskType};

/// SQLite implementation of the TaskRepository.
pub struct SqliteRepository {
    pool: SqlitePool,
}

/// Row representation for tasks from SQLite
#[derive(FromRow)]
#[allow(dead_code)]
struct TaskRow {
    id: String,
    user_id: String,
    title: String,
    priority: String,
    column_id: String,
    tags: String,           // JSON array
    due_date: Option<String>,
    created_at: String,
    recurrence: Option<String>,
    subtasks: String,       // JSON array
    order: i32,
    blocked_by: Option<String>,  // JSON object
    task_type: Option<String>,
    url: Option<String>,
}

impl SqliteRepository {
    /// Create a new SQLite repository and initialize the database
    pub async fn new(database_url: &str) -> Result<Self, DbError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;

        let repo = Self { pool };
        repo.initialize().await?;

        Ok(repo)
    }

    /// Initialize the database schema
    async fn initialize(&self) -> Result<(), DbError> {
        // Create table if it doesn't exist
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                priority TEXT NOT NULL,
                column_id TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                due_date TEXT,
                created_at TEXT NOT NULL,
                recurrence TEXT,
                subtasks TEXT NOT NULL DEFAULT '[]',
                "order" INTEGER NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        // Create index on user_id for faster queries
        sqlx::query(
            r#"
            CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)
            "#,
        )
        .execute(&self.pool)
        .await
        .ok();

        // Add order column if it doesn't exist (migration for existing databases)
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0
            "#,
        )
        .execute(&self.pool)
        .await
        .ok(); // Ignore error if column already exists

        // Add blocked_by column if it doesn't exist
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN blocked_by TEXT
            "#,
        )
        .execute(&self.pool)
        .await
        .ok(); // Ignore error if column already exists

        // Add task_type column if it doesn't exist
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'task'
            "#,
        )
        .execute(&self.pool)
        .await
        .ok(); // Ignore error if column already exists

        // Add url column if it doesn't exist
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN url TEXT
            "#,
        )
        .execute(&self.pool)
        .await
        .ok(); // Ignore error if column already exists

        Ok(())
    }

    fn row_to_task(&self, row: TaskRow) -> Result<Task, DbError> {
        let priority: Priority = serde_json::from_str(&format!("\"{}\"", row.priority))?;
        let column_id: ColumnId = serde_json::from_str(&format!("\"{}\"", row.column_id))?;
        let tags: Vec<TagId> = serde_json::from_str(&row.tags)?;
        let subtasks: Vec<Subtask> = serde_json::from_str(&row.subtasks)?;
        let recurrence: Option<Recurrence> = row
            .recurrence
            .map(|r| serde_json::from_str(&format!("\"{}\"", r)))
            .transpose()?;
        let due_date: Option<DateTime<Utc>> = row
            .due_date
            .map(|d| d.parse())
            .transpose()
            .map_err(|_| DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid date format",
            ))))?;
        let created_at: DateTime<Utc> = row
            .created_at
            .parse()
            .map_err(|_| DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid date format",
            ))))?;
        let blocked_by: Option<BlockedBy> = row
            .blocked_by
            .map(|b| serde_json::from_str(&b))
            .transpose()?;
        let task_type: TaskType = row
            .task_type
            .map(|t| serde_json::from_str(&format!("\"{}\"", t)))
            .transpose()?
            .unwrap_or_default();

        Ok(Task {
            id: row.id,
            title: row.title,
            priority,
            column_id,
            tags,
            due_date,
            created_at,
            recurrence,
            subtasks,
            order: row.order,
            blocked_by,
            task_type,
            url: row.url,
        })
    }
}

#[async_trait]
impl TaskRepository for SqliteRepository {
    async fn get_tasks(&self, user_id: &str) -> Result<Vec<Task>, DbError> {
        let rows: Vec<TaskRow> = sqlx::query_as(
            "SELECT id, user_id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\", blocked_by, task_type, url FROM tasks WHERE user_id = ? ORDER BY column_id, \"order\", created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(|row| self.row_to_task(row)).collect()
    }

    async fn get_task(&self, user_id: &str, id: &str) -> Result<Option<Task>, DbError> {
        let row: Option<TaskRow> = sqlx::query_as(
            "SELECT id, user_id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\", blocked_by, task_type, url FROM tasks WHERE id = ? AND user_id = ?"
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_task(row)?)),
            None => Ok(None),
        }
    }

    async fn create_task(&self, user_id: &str, request: CreateTaskRequest) -> Result<Task, DbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now();

        let priority_str = serde_json::to_string(&request.priority)?
            .trim_matches('"')
            .to_string();
        let column_id_str = serde_json::to_string(&request.column_id)?
            .trim_matches('"')
            .to_string();
        let tags_json = serde_json::to_string(&request.tags)?;
        let subtasks_json = serde_json::to_string(&request.subtasks)?;
        let recurrence_str = request
            .recurrence
            .as_ref()
            .map(|r| serde_json::to_string(r).map(|s| s.trim_matches('"').to_string()))
            .transpose()?;
        let due_date_str = request.due_date.map(|d| d.to_rfc3339());
        let created_at_str = created_at.to_rfc3339();
        let blocked_by_json = request
            .blocked_by
            .as_ref()
            .map(|b| serde_json::to_string(b))
            .transpose()?;
        let task_type_str = serde_json::to_string(&request.task_type)?
            .trim_matches('"')
            .to_string();

        // If order is not provided, set it to the max order in the column + 1
        let order = if request.order == 0 {
            let max_order: Option<(i32,)> = sqlx::query_as(
                "SELECT COALESCE(MAX(\"order\"), -1) + 1 FROM tasks WHERE column_id = ? AND user_id = ?"
            )
            .bind(&column_id_str)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;
            max_order.map(|(o,)| o).unwrap_or(0)
        } else {
            request.order
        };

        sqlx::query(
            r#"
            INSERT INTO tasks (id, user_id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order", blocked_by, task_type, url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(&request.title)
        .bind(&priority_str)
        .bind(&column_id_str)
        .bind(&tags_json)
        .bind(&due_date_str)
        .bind(&created_at_str)
        .bind(&recurrence_str)
        .bind(&subtasks_json)
        .bind(order)
        .bind(&blocked_by_json)
        .bind(&task_type_str)
        .bind(&request.url)
        .execute(&self.pool)
        .await?;

        Ok(Task {
            id,
            title: request.title,
            priority: request.priority,
            column_id: request.column_id,
            tags: request.tags,
            due_date: request.due_date,
            created_at,
            recurrence: request.recurrence,
            subtasks: request.subtasks,
            order,
            blocked_by: request.blocked_by,
            task_type: request.task_type,
            url: request.url,
        })
    }

    async fn update_task(&self, user_id: &str, id: &str, task: Task) -> Result<Task, DbError> {
        let priority_str = serde_json::to_string(&task.priority)?
            .trim_matches('"')
            .to_string();
        let column_id_str = serde_json::to_string(&task.column_id)?
            .trim_matches('"')
            .to_string();
        let tags_json = serde_json::to_string(&task.tags)?;
        let subtasks_json = serde_json::to_string(&task.subtasks)?;
        let recurrence_str = task
            .recurrence
            .as_ref()
            .map(|r| serde_json::to_string(r).map(|s| s.trim_matches('"').to_string()))
            .transpose()?;
        let due_date_str = task.due_date.map(|d| d.to_rfc3339());
        let blocked_by_json = task
            .blocked_by
            .as_ref()
            .map(|b| serde_json::to_string(b))
            .transpose()?;
        let task_type_str = serde_json::to_string(&task.task_type)?
            .trim_matches('"')
            .to_string();

        let result = sqlx::query(
            r#"
            UPDATE tasks 
            SET title = ?, priority = ?, column_id = ?, tags = ?, due_date = ?, recurrence = ?, subtasks = ?, "order" = ?, blocked_by = ?, task_type = ?, url = ?
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(&task.title)
        .bind(&priority_str)
        .bind(&column_id_str)
        .bind(&tags_json)
        .bind(&due_date_str)
        .bind(&recurrence_str)
        .bind(&subtasks_json)
        .bind(task.order)
        .bind(&blocked_by_json)
        .bind(&task_type_str)
        .bind(&task.url)
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(task)
    }

    async fn delete_task(&self, user_id: &str, id: &str) -> Result<(), DbError> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ? AND user_id = ?")
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(())
    }
}

