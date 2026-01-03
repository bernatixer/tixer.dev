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
    Doing,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Recurrence {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TagId {
    Shopping,
    Work,
    Personal,
    Ideas,
    Others,
}

// ============================================
// SUBTASK
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subtask {
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
    pub priority: Priority,
    pub column_id: ColumnId,
    pub tags: Vec<TagId>,
    pub due_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub recurrence: Option<Recurrence>,
    pub subtasks: Vec<Subtask>,
    #[serde(default)]
    pub order: i32,
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub title: String,
    pub priority: Priority,
    pub column_id: ColumnId,
    #[serde(default)]
    pub tags: Vec<TagId>,
    pub due_date: Option<DateTime<Utc>>,
    pub recurrence: Option<Recurrence>,
    #[serde(default)]
    pub subtasks: Vec<Subtask>,
    #[serde(default)]
    pub order: i32,
}

