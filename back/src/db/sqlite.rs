use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use uuid::Uuid;

use crate::db::{DbError, TaskRepository};
use crate::models::{ColumnId, CreateTaskRequest, Priority, Recurrence, Subtask, TagId, Task};

/// SQLite implementation of the TaskRepository.
pub struct SqliteRepository {
    pool: SqlitePool,
}

/// Row representation for tasks from SQLite
#[derive(FromRow)]
struct TaskRow {
    id: String,
    title: String,
    priority: String,
    column_id: String,
    tags: String,           // JSON array
    due_date: Option<String>,
    created_at: String,
    recurrence: Option<String>,
    subtasks: String,       // JSON array
    order: i32,
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

        // Add order column if it doesn't exist (migration for existing databases)
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0
            "#,
        )
        .execute(&self.pool)
        .await
        .ok(); // Ignore error if column already exists

        Ok(())
    }

    /// Seed the database with initial mock data (only if empty)
    pub async fn seed_if_empty(&self) -> Result<(), DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tasks")
            .fetch_one(&self.pool)
            .await?;

        if count.0 == 0 {
            self.seed_mock_data().await?;
        }

        Ok(())
    }

    async fn seed_mock_data(&self) -> Result<(), DbError> {
        let mock_tasks = vec![
            CreateTaskRequest {
                title: "Buy groceries".to_string(),
                priority: Priority::Medium,
                column_id: ColumnId::Todo,
                tags: vec![TagId::Shopping],
                due_date: None,
                recurrence: None,
                subtasks: vec![
                    Subtask {
                        id: Uuid::new_v4().to_string(),
                        text: "Milk".to_string(),
                        completed: false,
                    },
                    Subtask {
                        id: Uuid::new_v4().to_string(),
                        text: "Bread".to_string(),
                        completed: true,
                    },
                ],
                order: 0,
            },
            CreateTaskRequest {
                title: "Finish project report".to_string(),
                priority: Priority::High,
                column_id: ColumnId::Doing,
                tags: vec![TagId::Work],
                due_date: None,
                recurrence: None,
                subtasks: vec![],
                order: 0,
            },
            CreateTaskRequest {
                title: "Schedule dentist appointment".to_string(),
                priority: Priority::Low,
                column_id: ColumnId::Inbox,
                tags: vec![TagId::Health, TagId::Personal],
                due_date: None,
                recurrence: None,
                subtasks: vec![],
                order: 0,
            },
            CreateTaskRequest {
                title: "Review monthly expenses".to_string(),
                priority: Priority::Medium,
                column_id: ColumnId::Todo,
                tags: vec![TagId::Finance],
                due_date: None,
                recurrence: Some(Recurrence::Monthly),
                subtasks: vec![],
                order: 0,
            },
        ];

        for request in mock_tasks {
            self.create_task(request).await?;
        }

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
        })
    }
}

#[async_trait]
impl TaskRepository for SqliteRepository {
    async fn get_tasks(&self) -> Result<Vec<Task>, DbError> {
        let rows: Vec<TaskRow> = sqlx::query_as(
            "SELECT id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\" FROM tasks ORDER BY column_id, \"order\", created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(|row| self.row_to_task(row)).collect()
    }

    async fn get_task(&self, id: &str) -> Result<Option<Task>, DbError> {
        let row: Option<TaskRow> = sqlx::query_as(
            "SELECT id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\" FROM tasks WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_task(row)?)),
            None => Ok(None),
        }
    }

    async fn create_task(&self, request: CreateTaskRequest) -> Result<Task, DbError> {
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

        // If order is not provided, set it to the max order in the column + 1
        let order = if request.order == 0 {
            let max_order: Option<(i32,)> = sqlx::query_as(
                "SELECT COALESCE(MAX(\"order\"), -1) + 1 FROM tasks WHERE column_id = ?"
            )
            .bind(&column_id_str)
            .fetch_optional(&self.pool)
            .await?;
            max_order.map(|(o,)| o).unwrap_or(0)
        } else {
            request.order
        };

        sqlx::query(
            r#"
            INSERT INTO tasks (id, title, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&request.title)
        .bind(&priority_str)
        .bind(&column_id_str)
        .bind(&tags_json)
        .bind(&due_date_str)
        .bind(&created_at_str)
        .bind(&recurrence_str)
        .bind(&subtasks_json)
        .bind(order)
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
        })
    }

    async fn update_task(&self, id: &str, task: Task) -> Result<Task, DbError> {
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

        let result = sqlx::query(
            r#"
            UPDATE tasks 
            SET title = ?, priority = ?, column_id = ?, tags = ?, due_date = ?, recurrence = ?, subtasks = ?, "order" = ?
            WHERE id = ?
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
        .bind(id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(task)
    }

    async fn delete_task(&self, id: &str) -> Result<(), DbError> {
        let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(())
    }
}

