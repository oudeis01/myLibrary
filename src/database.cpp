/**
 * @file database.cpp
 * @brief Implementation of Database class for PostgreSQL operations
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include "database.h"
#include "auth.h"
#include <stdexcept>
#include <iostream>
#include <filesystem>

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
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                publisher VARCHAR(255),
                isbn VARCHAR(20),
                language VARCHAR(10) DEFAULT 'en',
                thumbnail_path VARCHAR(500),
                page_count INTEGER,
                metadata_extracted BOOLEAN DEFAULT FALSE,
                extraction_error TEXT
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
        conn->prepare("get_user_password_hash", 
            "SELECT password_hash FROM users WHERE username = $1");
        conn->prepare("get_user_id", 
            "SELECT id FROM users WHERE username = $1");

        // Book operations
        conn->prepare("insert_book", 
            "INSERT INTO books (title, author, file_path, file_type, file_size, description, publisher, isbn, language, thumbnail_path, page_count, metadata_extracted, extraction_error) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id");
        conn->prepare("get_book_id_by_path", 
            "SELECT id FROM books WHERE file_path = $1");
        conn->prepare("get_book_by_id", 
            "SELECT * FROM books WHERE id = $1");
        conn->prepare("get_all_books", 
            "SELECT id, title, author, file_path, file_type, file_size, uploaded_at, thumbnail_path FROM books ORDER BY uploaded_at DESC");

        // Progress operations
        conn->prepare("upsert_progress", 
            "INSERT INTO user_book_progress (user_id, book_id, progress_details) "
            "VALUES ($1, $2, $3) "
            "ON CONFLICT (user_id, book_id) DO UPDATE SET "
            "progress_details = EXCLUDED.progress_details, "
            "last_accessed_at = CURRENT_TIMESTAMP");
        conn->prepare("get_user_books_with_progress", 
            "SELECT b.id, b.title, b.author, b.file_type, b.file_size, b.uploaded_at, b.thumbnail_path, "
            "p.progress_details, p.last_accessed_at "
            "FROM books b "
            "LEFT JOIN user_book_progress p ON b.id = p.book_id AND p.user_id = $1 "
            "ORDER BY p.last_accessed_at DESC NULLS LAST, b.uploaded_at DESC");
        conn->prepare("get_progress_by_user_book", 
            "SELECT progress_details, last_accessed_at FROM user_book_progress "
            "WHERE user_id = $1 AND book_id = $2");

        // Orphaned records management
        conn->prepare("find_orphaned_books", 
            "SELECT id, title, file_path FROM books "
            "WHERE file_path IS NOT NULL AND file_path != ''");
        conn->prepare("delete_orphaned_books", 
            "DELETE FROM books WHERE id = ANY($1::int[])");

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

bool Database::authenticate_user(const std::string& username, const std::string& password) {
    try {
        pqxx::nontransaction txn(*conn);
        // Get the stored password hash for the user
        pqxx::result result = txn.exec_prepared("get_user_password_hash", username);
        if (result.empty()) {
            return false; // User not found
        }
        
        std::string stored_hash = result[0][0].as<std::string>();
        // Use Auth::verify_password to check if the plain password matches the stored hash
        return Auth::verify_password(password, stored_hash);
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
                       size_t file_size, const std::string& description, 
                       const std::string& publisher, const std::string& isbn,
                       const std::string& language, const std::string& thumbnail_path,
                       int page_count, bool metadata_extracted,
                       const std::string& extraction_error) {
    try {
        pqxx::work txn(*conn);
        pqxx::result result = txn.exec_prepared("insert_book", 
            title, author, file_path, file_type, static_cast<long>(file_size),
            description, publisher, isbn, language, thumbnail_path, 
            page_count, metadata_extracted, extraction_error);
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
            book["thumbnail_path"] = row["thumbnail_path"].is_null() ? "" : row["thumbnail_path"].as<std::string>();
            
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
            book["file_path"] = row["file_path"].as<std::string>();
            book["file_type"] = row["file_type"].as<std::string>();
            book["file_size"] = row["file_size"].as<long>();
            book["uploaded_at"] = row["uploaded_at"].as<std::string>();
            book["thumbnail_path"] = row["thumbnail_path"].is_null() ? "" : row["thumbnail_path"].as<std::string>();
            
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

/**
 * @brief Finds books in database where file doesn't exist on disk
 * @return Vector of book IDs that are orphaned
 */
std::vector<int> Database::find_orphaned_book_ids() {
    std::vector<int> orphaned_ids;
    try {
        pqxx::work txn(*conn);
        pqxx::result result = txn.exec_prepared("find_orphaned_books");
        
        for (auto row : result) {
            std::string file_path = row["file_path"].c_str();
            if (!std::filesystem::exists(file_path)) {
                orphaned_ids.push_back(row["id"].as<int>());
            }
        }
        
        std::cout << "Found " << orphaned_ids.size() << " orphaned book records" << std::endl;
        return orphaned_ids;
        
    } catch (const std::exception& e) {
        std::cerr << "Error finding orphaned books: " << e.what() << std::endl;
        return orphaned_ids;
    }
}

/**
 * @brief Removes orphaned books from database
 * @return Number of orphaned books removed
 */
int Database::cleanup_orphaned_books() {
    try {
        auto orphaned_ids = find_orphaned_book_ids();
        if (orphaned_ids.empty()) {
            std::cout << "No orphaned books found" << std::endl;
            return 0;
        }
        
        pqxx::work txn(*conn);
        // Convert to PostgreSQL array format
        std::string id_array = "{" + std::to_string(orphaned_ids[0]);
        for (size_t i = 1; i < orphaned_ids.size(); i++) {
            id_array += "," + std::to_string(orphaned_ids[i]);
        }
        id_array += "}";
        
        txn.exec_params("DELETE FROM books WHERE id = ANY($1::int[])", id_array);
        txn.commit();
        
        std::cout << "Successfully cleaned up " << orphaned_ids.size() << " orphaned books" << std::endl;
        return static_cast<int>(orphaned_ids.size());
        
    } catch (const std::exception& e) {
        std::cerr << "Error cleaning up orphaned books: " << e.what() << std::endl;
        return 0;
    }
}
