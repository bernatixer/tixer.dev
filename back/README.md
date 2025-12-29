# Backend

A Rust backend service for the todo app, built with [Axum](https://github.com/tokio-rs/axum).

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)

## Getting Started

```bash
# Run the development server
cargo run

# The server will start at http://127.0.0.1:3001
```

## Development

```bash
# Run with auto-reload (requires cargo-watch)
cargo install cargo-watch
cargo watch -x run

# Build for release
cargo build --release
```
