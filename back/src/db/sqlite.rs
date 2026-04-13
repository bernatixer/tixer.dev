use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool, sqlite::SqlitePoolOptions};
use uuid::Uuid;

use crate::db::{DbError, TaskRepository};
use crate::models::{
    BlockedBy, ColumnId, CreateTagRequest, CreateTaskRequest, Milestone, Priority, Recurrence, Tag,
    TagId, Task, TaskType,
};

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
    description: Option<String>,
    priority: String,
    column_id: String,
    tags: String, // JSON array
    due_date: Option<String>,
    created_at: String,
    recurrence: Option<String>,
    subtasks: String, // JSON array
    order: i32,
    blocked_by: Option<String>, // JSON object
    task_type: Option<String>,
    url: Option<String>,
    completed_at: Option<String>,
}

#[derive(FromRow)]
struct TagRow {
    id: String,
    name: String,
    color: String,
    created_at: String,
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
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

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
            CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id)
            "#,
        )
        .execute(&self.pool)
        .await
        .ok();

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

        // Add description column if it doesn't exist
        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN completed_at TEXT
            "#,
        )
        .execute(&self.pool)
        .await
        .ok();

        sqlx::query(
            r#"
            ALTER TABLE tasks ADD COLUMN description TEXT
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
        let milestones: Vec<Milestone> = serde_json::from_str(&row.subtasks)?;
        let recurrence: Option<Recurrence> = row
            .recurrence
            .map(|r| serde_json::from_str(&format!("\"{}\"", r)))
            .transpose()?;
        let due_date: Option<DateTime<Utc>> =
            row.due_date.map(|d| d.parse()).transpose().map_err(|_| {
                DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "Invalid date format",
                )))
            })?;
        let created_at: DateTime<Utc> = row.created_at.parse().map_err(|_| {
            DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid date format",
            )))
        })?;
        let blocked_by: Option<BlockedBy> = row
            .blocked_by
            .map(|b| serde_json::from_str(&b))
            .transpose()?;
        let task_type: TaskType = row
            .task_type
            .map(|t| serde_json::from_str(&format!("\"{}\"", t)))
            .transpose()?
            .unwrap_or_default();
        let completed_at: Option<DateTime<Utc>> = row
            .completed_at
            .map(|d| d.parse())
            .transpose()
            .map_err(|_| {
            DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid date format",
            )))
        })?;

        Ok(Task {
            id: row.id,
            title: row.title,
            description: row.description,
            priority,
            column_id,
            tags,
            due_date,
            created_at,
            recurrence,
            milestones,
            order: row.order,
            blocked_by,
            task_type,
            url: row.url,
            completed_at,
        })
    }

    fn row_to_tag(&self, row: TagRow) -> Result<Tag, DbError> {
        let created_at: DateTime<Utc> = row.created_at.parse().map_err(|_| {
            DbError::Serialization(serde_json::Error::io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid date format",
            )))
        })?;

        Ok(Tag {
            id: row.id,
            name: row.name,
            color: row.color,
            created_at,
        })
    }
}

#[async_trait]
impl TaskRepository for SqliteRepository {
    async fn get_tasks(&self, user_id: &str) -> Result<Vec<Task>, DbError> {
        let rows: Vec<TaskRow> = sqlx::query_as(
            "SELECT id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\", blocked_by, task_type, url, completed_at FROM tasks WHERE user_id = ? ORDER BY column_id, \"order\", created_at DESC"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(|row| self.row_to_task(row)).collect()
    }

    async fn get_task(&self, user_id: &str, id: &str) -> Result<Option<Task>, DbError> {
        let row: Option<TaskRow> = sqlx::query_as(
            "SELECT id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\", blocked_by, task_type, url, completed_at FROM tasks WHERE id = ? AND user_id = ?"
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

    async fn create_task(
        &self,
        user_id: &str,
        request: CreateTaskRequest,
    ) -> Result<Task, DbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now();

        let priority_str = serde_json::to_string(&request.priority)?
            .trim_matches('"')
            .to_string();
        let column_id_str = serde_json::to_string(&request.column_id)?
            .trim_matches('"')
            .to_string();
        let tags_json = serde_json::to_string(&request.tags)?;
        let milestones_json = serde_json::to_string(&request.milestones)?;
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
        let completed_at = if request.column_id == ColumnId::Done {
            request.completed_at.or(Some(Utc::now()))
        } else {
            None
        };
        let completed_at_str = completed_at.map(|d| d.to_rfc3339());

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
            INSERT INTO tasks (id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, "order", blocked_by, task_type, url, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(&request.title)
        .bind(&request.description)
        .bind(&priority_str)
        .bind(&column_id_str)
        .bind(&tags_json)
        .bind(&due_date_str)
        .bind(&created_at_str)
        .bind(&recurrence_str)
        .bind(&milestones_json)
        .bind(order)
        .bind(&blocked_by_json)
        .bind(&task_type_str)
        .bind(&request.url)
        .bind(&completed_at_str)
        .execute(&self.pool)
        .await?;

        Ok(Task {
            id,
            title: request.title,
            description: request.description,
            priority: request.priority,
            column_id: request.column_id,
            tags: request.tags,
            due_date: request.due_date,
            created_at,
            recurrence: request.recurrence,
            milestones: request.milestones,
            order,
            blocked_by: request.blocked_by,
            task_type: request.task_type,
            url: request.url,
            completed_at,
        })
    }

    async fn get_tags(&self, user_id: &str) -> Result<Vec<Tag>, DbError> {
        let rows: Vec<TagRow> = sqlx::query_as(
            "SELECT id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY created_at ASC"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter().map(|row| self.row_to_tag(row)).collect()
    }

    async fn create_tag(&self, user_id: &str, request: CreateTagRequest) -> Result<Tag, DbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now();
        let created_at_str = created_at.to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO tags (id, user_id, name, color, created_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(&request.name)
        .bind(&request.color)
        .bind(&created_at_str)
        .execute(&self.pool)
        .await?;

        Ok(Tag {
            id,
            name: request.name,
            color: request.color,
            created_at,
        })
    }

    async fn update_task(&self, user_id: &str, id: &str, task: Task) -> Result<Task, DbError> {
        let existing = self.get_task(user_id, id).await?;
        if existing.is_none() {
            return Err(DbError::NotFound);
        }

        let priority_str = serde_json::to_string(&task.priority)?
            .trim_matches('"')
            .to_string();
        let column_id_str = serde_json::to_string(&task.column_id)?
            .trim_matches('"')
            .to_string();
        let tags_json = serde_json::to_string(&task.tags)?;
        let milestones_json = serde_json::to_string(&task.milestones)?;
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
        let normalized_completed_at = if task.column_id == ColumnId::Done {
            task.completed_at
                .or_else(|| existing.and_then(|t| t.completed_at))
                .or(Some(Utc::now()))
        } else {
            None
        };
        let completed_at_str = normalized_completed_at.map(|d| d.to_rfc3339());

        let result = sqlx::query(
            r#"
            UPDATE tasks 
            SET title = ?, description = ?, priority = ?, column_id = ?, tags = ?, due_date = ?, recurrence = ?, subtasks = ?, "order" = ?, blocked_by = ?, task_type = ?, url = ?, completed_at = ?
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(&task.title)
        .bind(&task.description)
        .bind(&priority_str)
        .bind(&column_id_str)
        .bind(&tags_json)
        .bind(&due_date_str)
        .bind(&recurrence_str)
        .bind(&milestones_json)
        .bind(task.order)
        .bind(&blocked_by_json)
        .bind(&task_type_str)
        .bind(&task.url)
        .bind(&completed_at_str)
        .bind(id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        Ok(Task {
            completed_at: normalized_completed_at,
            ..task
        })
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

    async fn delete_tag(&self, user_id: &str, id: &str) -> Result<(), DbError> {
        // Delete the tag
        let result = sqlx::query("DELETE FROM tags WHERE id = ? AND user_id = ?")
            .bind(id)
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(DbError::NotFound);
        }

        // Remove the tag from all tasks that reference it
        // Tags are stored as JSON arrays, so we need to fetch, filter, and update
        let rows: Vec<TaskRow> = sqlx::query_as(
            "SELECT id, user_id, title, description, priority, column_id, tags, due_date, created_at, recurrence, subtasks, \"order\", blocked_by, task_type, url, completed_at FROM tasks WHERE user_id = ? AND tags LIKE ?",
        )
        .bind(user_id)
        .bind(format!("%{}%", id))
        .fetch_all(&self.pool)
        .await?;

        for row in rows {
            let mut tags: Vec<String> = serde_json::from_str(&row.tags)?;
            tags.retain(|t| t != id);
            let updated_tags = serde_json::to_string(&tags)?;
            sqlx::query("UPDATE tasks SET tags = ? WHERE id = ? AND user_id = ?")
                .bind(&updated_tags)
                .bind(&row.id)
                .bind(user_id)
                .execute(&self.pool)
                .await?;
        }

        Ok(())
    }
}
