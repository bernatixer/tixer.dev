# Backend

A Rust backend service for the todo app, built with [Axum](https://github.com/tokio-rs/axum).

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)

## Getting Started

```bash
# Run the development server
cargo run
```

The server will start at `http://127.0.0.1:5555` and automatically create a SQLite database file (`tixer.db`) in the project directory.

## Database

The backend uses SQLite for data persistence with a repository abstraction layer that makes it easy to swap database backends in the future (PostgreSQL, Cloudflare D1, etc.).

### Architecture

- `db/repository.rs` - Defines the `TaskRepository` trait (the abstraction)
- `db/sqlite.rs` - SQLite implementation of `TaskRepository`
- `db/error.rs` - Database error types

To add a new database backend:
1. Create a new file in `db/` (e.g., `postgres.rs`)
2. Implement the `TaskRepository` trait
3. Update `main.rs` to use the new implementation

## Development

```bash
# Run with auto-reload (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Build for release
cargo build --release
```
