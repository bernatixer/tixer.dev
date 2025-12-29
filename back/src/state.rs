use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;
use uuid::Uuid;

use crate::models::{ColumnId, CreateTaskRequest, Priority, Subtask, TagId, Task};

// ============================================
// APP STATE
// ============================================

#[derive(Clone)]
pub struct AppState {
    pub tasks: Arc<RwLock<Vec<Task>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(RwLock::new(Self::mock_tasks())),
        }
    }

    fn mock_tasks() -> Vec<Task> {
        vec![
            Task {
                id: Uuid::new_v4().to_string(),
                title: "Buy groceries".to_string(),
                priority: Priority::Medium,
                column_id: ColumnId::Todo,
                tags: vec![TagId::Shopping],
                due_date: None,
                created_at: Utc::now(),
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
            },
            Task {
                id: Uuid::new_v4().to_string(),
                title: "Finish project report".to_string(),
                priority: Priority::High,
                column_id: ColumnId::Doing,
                tags: vec![TagId::Work],
                due_date: None,
                created_at: Utc::now(),
                recurrence: None,
                subtasks: vec![],
            },
            Task {
                id: Uuid::new_v4().to_string(),
                title: "Schedule dentist appointment".to_string(),
                priority: Priority::Low,
                column_id: ColumnId::Inbox,
                tags: vec![TagId::Health, TagId::Personal],
                due_date: None,
                created_at: Utc::now(),
                recurrence: None,
                subtasks: vec![],
            },
            Task {
                id: Uuid::new_v4().to_string(),
                title: "Review monthly expenses".to_string(),
                priority: Priority::Medium,
                column_id: ColumnId::Todo,
                tags: vec![TagId::Finance],
                due_date: None,
                created_at: Utc::now(),
                recurrence: Some(crate::models::Recurrence::Monthly),
                subtasks: vec![],
            },
        ]
    }
}

// ============================================
// STATE OPERATIONS
// ============================================

impl AppState {
    pub async fn get_tasks(&self) -> Vec<Task> {
        self.tasks.read().await.clone()
    }

    pub async fn get_task(&self, id: &str) -> Option<Task> {
        self.tasks
            .read()
            .await
            .iter()
            .find(|t| t.id == id)
            .cloned()
    }

    pub async fn create_task(&self, request: CreateTaskRequest) -> Task {
        let task = Task {
            id: Uuid::new_v4().to_string(),
            title: request.title,
            priority: request.priority,
            column_id: request.column_id,
            tags: request.tags,
            due_date: request.due_date,
            created_at: Utc::now(),
            recurrence: request.recurrence,
            subtasks: request.subtasks,
        };

        self.tasks.write().await.push(task.clone());
        task
    }
}

