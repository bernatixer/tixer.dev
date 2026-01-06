mod auth;
mod db;
mod handlers;
mod models;
mod state;

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

use db::SqliteRepository;
use handlers::{health, tasks};
use state::AppState;

#[tokio::main]
async fn main() {
    // Load environment variables based on RUN_MODE
    // Priority: .env.{mode} -> .env.local -> .env
    let run_mode = std::env::var("RUN_MODE").unwrap_or_else(|_| "development".to_string());
    
    // Try to load mode-specific env file first
    let mode_env = format!(".env.{}", run_mode);
    if dotenvy::from_filename(&mode_env).is_ok() {
        println!("📝 Loaded environment from {}", mode_env);
    } else if dotenvy::from_filename(".env.local").is_ok() {
        println!("📝 Loaded environment from .env.local");
    } else if dotenvy::dotenv().is_ok() {
        println!("📝 Loaded environment from .env");
    } else {
        println!("📝 No environment file found, using default values");
    }

    // Initialize SQLite database
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:tixer.db?mode=rwc".to_string());
    
    let repo = SqliteRepository::new(&database_url)
        .await
        .expect("Failed to connect to database");

    // Initialize app state with the repository
    let state = AppState::new(repo);

    // Configure CORS for frontend integration (fully permissive for development)
    let cors = CorsLayer::very_permissive();

    // Build the router
    let app = Router::new()
        .route("/api/health", get(health::health))
        .route("/api/tasks", get(tasks::list_tasks).post(tasks::create_task))
        .route(
            "/api/tasks/:id",
            get(tasks::get_task)
                .put(tasks::update_task)
                .delete(tasks::delete_task),
        )
        .layer(cors)
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(5555);
    
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Server running at http://{}", addr);
    println!("📁 Using database: {}", database_url);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
