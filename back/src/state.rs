use std::sync::Arc;

use crate::db::TaskRepository;

// ============================================
// APP STATE
// ============================================

/// Application state that holds the repository.
/// 
/// The repository is abstracted behind a trait, allowing different
/// implementations (SQLite, PostgreSQL, D1, etc.) to be swapped easily.
#[derive(Clone)]
pub struct AppState {
    pub repo: Arc<dyn TaskRepository>,
}

impl AppState {
    pub fn new(repo: impl TaskRepository + 'static) -> Self {
        Self {
            repo: Arc::new(repo),
        }
    }
}
