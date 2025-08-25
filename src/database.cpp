/**
 * @file database.cpp
 * @brief Implementation of Database class for PostgreSQL operations
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include "database.h"
#include <stdexcept>
#include <iostream>

Database::Database(const std::string& connection_string) {
    try {
        conn = std::make_unique<pqxx::connection>(connection_string);
        if (!conn->is_open()) {
            throw std::runtime_error("Failed to open database connection");
        }
        std::cout << "Connected to database successfully!" << std::endl;
        
        create_tables_if_not_exists();
        prepare_statements();
    } catch (const std::exception& e) {
        throw std::runtime_error("Database connection failed: " + std::string(e.what()));
    }
}

void Database::create_tables_if_not_exists() {
    try {
        pqxx::work txn(*conn);

        // Create users table
        txn.exec(R"(
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        )");

        // Create books table
        txn.exec(R"(
            CREATE TABLE IF NOT EXISTS books (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(255),
                file_path VARCHAR(500) UNIQUE NOT NULL,
                file_type VARCHAR(10) NOT NULL,
                file_size BIGINT NOT NULL DEFAULT 0,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        )");

        // Create user_book_progress table
        txn.exec(R"(
            CREATE TABLE IF NOT EXISTS user_book_progress (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                progress_details JSONB,
                PRIMARY KEY (user_id, book_id)
            )
        )");

        // Create indexes for better performance
        txn.exec("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)");
        txn.exec("CREATE INDEX IF NOT EXISTS idx_books_file_path ON books(file_path)");
        txn.exec("CREATE INDEX IF NOT EXISTS idx_progress_user_id ON user_book_progress(user_id)");

        txn.commit();
        std::cout << "Database tables created or verified successfully." << std::endl;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to create tables: " + std::string(e.what()));
    }
}

void Database::prepare_statements() {
    try {
        // User operations
        conn->prepare("insert_user", 
            "INSERT INTO users (username, password_hash) VALUES ($1, $2)");
        conn->prepare("select_user_by_credentials", 
            "SELECT id FROM users WHERE username = $1 AND password_hash = $2");
        conn->prepare("get_user_id", 
            "SELECT id FROM users WHERE username = $1");

        // Book operations
        conn->prepare("insert_book", 
            "INSERT INTO books (title, author, file_path, file_type, file_size) "
            "VALUES ($1, $2, $3, $4, $5) RETURNING id");
        conn->prepare("get_book_id_by_path", 
            "SELECT id FROM books WHERE file_path = $1");
        conn->prepare("get_book_by_id", 
            "SELECT * FROM books WHERE id = $1");
        conn->prepare("get_all_books", 
            "SELECT id, title, author, file_type, file_size, uploaded_at FROM books ORDER BY uploaded_at DESC");

        // Progress operations
        conn->prepare("upsert_progress", 
            "INSERT INTO user_book_progress (user_id, book_id, progress_details) "
            "VALUES ($1, $2, $3) "
            "ON CONFLICT (user_id, book_id) DO UPDATE SET "
            "progress_details = EXCLUDED.progress_details, "
            "last_accessed_at = CURRENT_TIMESTAMP");
        conn->prepare("get_user_books_with_progress", 
            "SELECT b.id, b.title, b.author, b.file_type, b.file_size, b.uploaded_at, "
            "p.progress_details, p.last_accessed_at "
            "FROM books b "
            "LEFT JOIN user_book_progress p ON b.id = p.book_id AND p.user_id = $1 "
            "ORDER BY p.last_accessed_at DESC NULLS LAST, b.uploaded_at DESC");
        conn->prepare("get_progress_by_user_book", 
            "SELECT progress_details, last_accessed_at FROM user_book_progress "
            "WHERE user_id = $1 AND book_id = $2");

        std::cout << "Database prepared statements created successfully." << std::endl;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to prepare statements: " + std::string(e.what()));
    }
}

void Database::create_user(const std::string& username, const std::string& password_hash) {
    try {
        pqxx::work txn(*conn);
        txn.exec_prepared("insert_user", username, password_hash);
        txn.commit();
        std::cout << "User '" << username << "' created successfully." << std::endl;
    } catch (const pqxx::unique_violation& e) {
        throw std::runtime_error("Username already exists");
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to create user: " + std::string(e.what()));
    }
}

bool Database::authenticate_user(const std::string& username, const std::string& password_hash) {
    try {
        pqxx::nontransaction txn(*conn);
        pqxx::result result = txn.exec_prepared("select_user_by_credentials", username, password_hash);
        return !result.empty();
    } catch (const std::exception& e) {
        std::cerr << "Authentication error: " << e.what() << std::endl;
        return false;
    }
}

long Database::get_user_id(const std::string& username) {
    try {
        pqxx::nontransaction txn(*conn);
        pqxx::result result = txn.exec_prepared("get_user_id", username);
        if (!result.empty()) {
            return result[0][0].as<long>();
        }
        return -1;
    } catch (const std::exception& e) {
        std::cerr << "Error getting user ID: " << e.what() << std::endl;
        return -1;
    }
}

long Database::add_book(const std::string& title, const std::string& author, 
                       const std::string& file_path, const std::string& file_type, 
                       size_t file_size) {
    try {
        pqxx::work txn(*conn);
        pqxx::result result = txn.exec_prepared("insert_book", title, author, file_path, file_type, static_cast<long>(file_size));
        txn.commit();
        
        if (!result.empty()) {
            long book_id = result[0][0].as<long>();
            std::cout << "Book '" << title << "' added successfully with ID: " << book_id << std::endl;
            return book_id;
        }
        throw std::runtime_error("Failed to get book ID after insertion");
    } catch (const pqxx::unique_violation& e) {
        throw std::runtime_error("Book with this file path already exists");
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to add book: " + std::string(e.what()));
    }
}

long Database::get_book_id(const std::string& file_path) {
    try {
        pqxx::nontransaction txn(*conn);
        pqxx::result result = txn.exec_prepared("get_book_id_by_path", file_path);
        if (!result.empty()) {
            return result[0][0].as<long>();
        }
        return -1;
    } catch (const std::exception& e) {
        std::cerr << "Error getting book ID: " << e.what() << std::endl;
        return -1;
    }
}

void Database::update_user_book_progress(long user_id, long book_id, 
                                        const nlohmann::json& progress_details) {
    try {
        pqxx::work txn(*conn);
        txn.exec_prepared("upsert_progress", user_id, book_id, progress_details.dump());
        txn.commit();
        std::cout << "Progress updated for user " << user_id << " on book " << book_id << std::endl;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to update progress: " + std::string(e.what()));
    }
}

nlohmann::json Database::get_user_books_with_progress(long user_id) {
    try {
        pqxx::nontransaction txn(*conn);
        pqxx::result result = txn.exec_prepared("get_user_books_with_progress", user_id);
        
        nlohmann::json books = nlohmann::json::array();
        
        for (const auto& row : result) {
            nlohmann::json book;
            book["id"] = row["id"].as<long>();
            book["title"] = row["title"].as<std::string>();
            book["author"] = row["author"].is_null() ? "" : row["author"].as<std::string>();
            book["file_type"] = row["file_type"].as<std::string>();
            book["file_size"] = row["file_size"].as<long>();
            book["uploaded_at"] = row["uploaded_at"].as<std::string>();
            
            if (!row["progress_details"].is_null()) {
                book["progress"] = nlohmann::json::parse(row["progress_details"].as<std::string>());
                book["last_accessed_at"] = row["last_accessed_at"].as<std::string>();
            } else {
                book["progress"] = nullptr;
                book["last_accessed_at"] = nullptr;
            }
            
            books.push_back(book);
        }
        
        return books;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to get user books: " + std::string(e.what()));
    }
}

nlohmann::json Database::get_all_books() {
    try {
        pqxx::nontransaction txn(*conn);
        pqxx::result result = txn.exec_prepared("get_all_books");
        
        nlohmann::json books = nlohmann::json::array();
        
        for (const auto& row : result) {
            nlohmann::json book;
            book["id"] = row["id"].as<long>();
            book["title"] = row["title"].as<std::string>();
            book["author"] = row["author"].is_null() ? "" : row["author"].as<std::string>();
            book["file_type"] = row["file_type"].as<std::string>();
            book["file_size"] = row["file_size"].as<long>();
            book["uploaded_at"] = row["uploaded_at"].as<std::string>();
            
            books.push_back(book);
        }
        
        return books;
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to get all books: " + std::string(e.what()));
    }
}

bool Database::is_connected() const {
    return conn && conn->is_open();
}





/**
 * @brief Get user's reading progress for a specific book
 * @param user_id User ID
 * @param book_id Book ID
 * @return JSON object with progress data, or null if no progress found
 */
nlohmann::json Database::get_user_book_progress(long user_id, long book_id) {
    try {
        pqxx::work txn(*conn);
        
        std::string query = R"(
            SELECT progress_details, last_accessed_at 
            FROM user_book_progress 
            WHERE user_id = $1 AND book_id = $2
        )";
        
        pqxx::result result = txn.exec_params(query, user_id, book_id);
        
        if (result.empty()) {
            return nullptr;
        }
        
        auto row = result[0];
        nlohmann::json progress;
        
        try {
            std::string progress_str = row["progress_details"].as<std::string>();
            progress = nlohmann::json::parse(progress_str);
            progress["last_accessed_at"] = row["last_accessed_at"].as<std::string>();
        } catch (const std::exception& e) {
            std::cerr << "Invalid progress JSON: " << e.what() << std::endl;
            return nullptr;
        }
        
        return progress;
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting user book progress: " << e.what() << std::endl;
        return nullptr;
    }
}
