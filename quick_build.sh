#!/bin/bash

# @file quick_build.sh
# @brief Fast build script for MyLibrary project
# @details Optimized build script that minimizes dependencies recompilation

set -e  # Exit on any error

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${PROJECT_DIR}/build"

echo "🚀 MyLibrary Quick Build Script"
echo "================================"

# Function to show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --clean, -c     Clean build (removes build directory)"
    echo "  --fresh, -f     Fresh build (keeps cached dependencies)"
    echo "  --parallel N    Use N parallel jobs (default: number of CPU cores)"
    echo "  --help, -h      Show this help"
    echo ""
    echo "Examples:"
    echo "  $0              # Normal incremental build"
    echo "  $0 --fresh      # Fresh build but keep dependency cache"
    echo "  $0 --clean      # Complete clean build"
    echo "  $0 --parallel 4 # Build with 4 parallel jobs"
}

# Parse command line arguments
CLEAN_BUILD=false
FRESH_BUILD=false
PARALLEL_JOBS=$(nproc)

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean|-c)
            CLEAN_BUILD=true
            shift
            ;;
        --fresh|-f)
            FRESH_BUILD=true
            shift
            ;;
        --parallel)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Clean build if requested
if [ "$CLEAN_BUILD" = true ]; then
    echo "🧹 Cleaning build directory..."
    rm -rf "${BUILD_DIR}"
fi

# Fresh build if requested (keeps dependency cache)
if [ "$FRESH_BUILD" = true ]; then
    echo "🔄 Fresh build (keeping dependency cache)..."
    if [ -d "${BUILD_DIR}" ]; then
        # Keep the dependency cache but remove everything else
        if [ -d "${BUILD_DIR}/_deps" ]; then
            mv "${BUILD_DIR}/_deps" "${PROJECT_DIR}/.deps_cache_backup"
        fi
        rm -rf "${BUILD_DIR}"
        mkdir -p "${BUILD_DIR}"
        if [ -d "${PROJECT_DIR}/.deps_cache_backup" ]; then
            mv "${PROJECT_DIR}/.deps_cache_backup" "${BUILD_DIR}/_deps"
        fi
    fi
fi

# Create build directory if it doesn't exist
mkdir -p "${BUILD_DIR}"

# Configure with optimization flags for faster compilation
echo "⚙️  Configuring build..."
cd "${PROJECT_DIR}"

cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_FLAGS="-O2 -march=native" \
    -DFETCHCONTENT_QUIET=ON \
    -DFETCHCONTENT_UPDATES_DISCONNECTED=ON

# Build with parallel jobs
echo "🔨 Building with ${PARALLEL_JOBS} parallel jobs..."
cmake --build build --parallel "${PARALLEL_JOBS}"

echo "✅ Build completed successfully!"
echo ""
echo "To run the server:"
echo "  cd build && ./mylibrary_server"
echo ""
echo "Build time optimization tips:"
echo "  • Use './quick_build.sh --fresh' for faster rebuilds"
echo "  • Dependencies are cached in .deps_cache for faster subsequent builds"
echo "  • Use '--parallel N' to control compilation parallelism"
