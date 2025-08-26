cmake_minimum_required(VERSION 3.15)

project(MyLibraryServer VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find system packages first
find_package(PkgConfig REQUIRED)

# PostgreSQL client library (libpq)
find_package(PostgreSQL REQUIRED)

# libpqxx (PostgreSQL C++ client)
pkg_check_modules(PQXX REQUIRED libpqxx)

# OpenSSL for secure password hashing
find_package(OpenSSL REQUIRED)

# Threads
find_package(Threads REQUIRED)

# Include FetchContent module for dependencies not available in system
include(FetchContent)

# Use optimized dependency management
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/Dependencies.cmake)

# Add executable
add_executable(mylibrary_server 
    src/main.cpp
    src/database.cpp
    src/auth.cpp
    src/book_manager.cpp
    src/http_server.cpp
)

# Set target properties and include directories
target_include_directories(mylibrary_server PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${PostgreSQL_INCLUDE_DIRS}
    ${PQXX_INCLUDE_DIRS}
)

# Link libraries - prioritize system libraries
target_link_libraries(mylibrary_server PRIVATE 
    ${PostgreSQL_LIBRARIES}
    ${PQXX_LIBRARIES}
    OpenSSL::SSL
    OpenSSL::Crypto
    nlohmann_json::nlohmann_json
    httplib::httplib
    Threads::Threads
)

# Set compiler flags
target_compile_options(mylibrary_server PRIVATE ${PQXX_CFLAGS_OTHER})

# Create directories for uploads, books, and thumbnails
file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/uploads)
file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/books)
file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/thumbnails)

# Copy setup scripts to build directory
configure_file(setup_db.sql ${CMAKE_CURRENT_BINARY_DIR}/setup_db.sql COPYONLY)
configure_file(upgrade_db.sql ${CMAKE_CURRENT_BINARY_DIR}/upgrade_db.sql COPYONLY)

# Print configuration summary
message(STATUS "=== MyLibrary Server Configuration ===")
message(STATUS "PostgreSQL found: ${PostgreSQL_FOUND}")
message(STATUS "PostgreSQL version: ${PostgreSQL_VERSION_STRING}")
message(STATUS "PostgreSQL libraries: ${PostgreSQL_LIBRARIES}")
message(STATUS "libpqxx found: ${PQXX_FOUND}")
message(STATUS "libpqxx version: ${PQXX_VERSION}")
message(STATUS "OpenSSL found: ${OPENSSL_FOUND}")
message(STATUS "OpenSSL version: ${OPENSSL_VERSION}")
message(STATUS "=======================================")
