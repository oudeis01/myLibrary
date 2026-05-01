FROM rust:1.77-slim AS builder
# WORKDIR = /workspace/backend so that ../migrations = /workspace/migrations
# (matches sqlx::migrate!("../migrations") with CARGO_MANIFEST_DIR=/workspace/backend)
WORKDIR /workspace/backend

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY backend/Cargo.toml backend/Cargo.lock ./
COPY migrations/ /workspace/migrations/
RUN mkdir src && echo "fn main(){}" > src/main.rs
ENV SQLX_OFFLINE=true
RUN cargo build --release
RUN rm -rf src

COPY backend/src ./src
COPY backend/.sqlx ./.sqlx
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y ca-certificates libssl3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/backend/target/release/ebook-server /usr/local/bin/
EXPOSE 3001
CMD ["ebook-server"]
