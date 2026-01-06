mod auth;
mod db;
mod handlers;
mod models;
mod state;

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use db::SqliteRepository;
use handlers::{health, tasks};
use state::AppState;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "back=debug,tower_http=debug".into()))
        .init();

    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Initialize SQLite database
    // The database file will be created in the current directory
    let database_url = "sqlite:tixer.db?mode=rwc";
    
    let repo = SqliteRepository::new(database_url)
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
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 5555));
    println!("🚀 Server running at http://{}", addr);
    println!("📁 Using SQLite database: tixer.db");

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
