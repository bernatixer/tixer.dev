use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ============================================
// ENUMS
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Urgent,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ColumnId {
    Inbox,
    Todo,
    Blocked,
    Doing,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum BlockedBy {
    #[serde(rename = "text")]
    Text { reason: String },
    #[serde(rename = "task")]
    Task {
        #[serde(rename = "taskId")]
        task_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Recurrence {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

pub type TagId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    #[default]
    Task,
    Book,
    Video,
    Article,
    Movie,
}

// ============================================
// TAG
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color: String,
    pub created_at: DateTime<Utc>,
}

// ============================================
// MILESTONE
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: String,
    pub text: String,
    pub completed: bool,
}

// ============================================
// TASK
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Priority,
    pub column_id: ColumnId,
    pub tags: Vec<TagId>,
    pub due_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub recurrence: Option<Recurrence>,
    #[serde(default, alias = "subtasks")]
    pub milestones: Vec<Milestone>,
    #[serde(default)]
    pub order: i32,
    pub blocked_by: Option<BlockedBy>,
    #[serde(default)]
    pub task_type: TaskType,
    pub url: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: Priority,
    pub column_id: ColumnId,
    #[serde(default)]
    pub tags: Vec<TagId>,
    pub due_date: Option<DateTime<Utc>>,
    pub recurrence: Option<Recurrence>,
    #[serde(default)]
    #[serde(alias = "subtasks")]
    pub milestones: Vec<Milestone>,
    #[serde(default)]
    pub order: i32,
    pub blocked_by: Option<BlockedBy>,
    #[serde(default)]
    pub task_type: TaskType,
    pub url: Option<String>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagRequest {
    pub name: String,
    pub color: String,
}
