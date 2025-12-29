mod handlers;
mod models;
mod state;

use axum::{
    http::{header, Method},
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

use handlers::{health, tasks};
use state::AppState;

#[tokio::main]
async fn main() {
    // Initialize app state with mock data
    let state = AppState::new();

    // Configure CORS for frontend integration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE]);

    // Build the router
    let app = Router::new()
        .route("/health", get(health::health))
        .route("/tasks", get(tasks::list_tasks).post(tasks::create_task))
        .route("/tasks/:id", get(tasks::get_task))
        .layer(cors)
        .with_state(state);

    // Set the address (port 3001 to avoid conflict with frontend dev server)
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("🚀 Server running at http://{}", addr);

    // Start the server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
