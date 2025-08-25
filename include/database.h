/**
 * @file database.h
 * @brief Database connection and operation management for MyLibrary server
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#ifndef DATABASE_H
#define DATABASE_H

#include <pqxx/pqxx>
#include <string>
#include <nlohmann/json.hpp>

/**
 * @class Database
 * @brief Manages PostgreSQL database connections and operations
 * 
 * This class provides a centralized interface for all database operations
 * including user management, book management, and progress tracking.
 */
class Database {
private:
    std::unique_ptr<pqxx::connection> conn; ///< PostgreSQL connection object

public:
    /**
     * @brief Constructor that establishes database connection
     * @param connection_string PostgreSQL connection string
     * @throws std::runtime_error if connection fails
     */
    explicit Database(const std::string& connection_string);
    
    /**
     * @brief Destructor
     */
    ~Database() = default;

    /**
     * @brief Creates all necessary database tables if they don't exist
     * @throws std::runtime_error if table creation fails
     */
    void create_tables_if_not_exists();

    /**
     * @brief Creates prepared statements for database operations
     * @throws std::runtime_error if statement preparation fails
     */
    void prepare_statements();

    /**
     * @brief Creates a new user in the database
     * @param username Unique username for the user
     * @param password_hash BCrypt hashed password
     * @throws std::runtime_error if user creation fails
     */
    void create_user(const std::string& username, const std::string& password_hash);

    /**
     * @brief Validates user credentials
     * @param username Username to authenticate
     * @param password Plain text password (will be verified against stored hash)
     * @return true if authentication successful, false otherwise
     */
    bool authenticate_user(const std::string& username, const std::string& password);

    /**
     * @brief Retrieves user ID by username
     * @param username Username to look up
     * @return User ID if found, -1 if not found
     */
    long get_user_id(const std::string& username);

    /**
     * @brief Adds a new book to the database
     * @param title Book title
     * @param author Book author
     * @param file_path Path to the book file
     * @param file_type Type of book file (epub, pdf, cbz)
     * @param file_size Size of the file in bytes
     * @return Book ID of the newly added book
     * @throws std::runtime_error if book addition fails
     */
    long add_book(const std::string& title, const std::string& author, 
                  const std::string& file_path, const std::string& file_type, 
                  size_t file_size);

    /**
     * @brief Retrieves book ID by file path
     * @param file_path Path to the book file
     * @return Book ID if found, -1 if not found
     */
    long get_book_id(const std::string& file_path);

    /**
     * @brief Updates or inserts user reading progress for a book
     * @param user_id ID of the user
     * @param book_id ID of the book
     * @param progress_details JSON object containing progress information
     * @throws std::runtime_error if progress update fails
     */
    void update_user_book_progress(long user_id, long book_id, 
                                   const nlohmann::json& progress_details);

    /**
     * @brief Retrieves all books and their progress for a user
     * @param user_id ID of the user
     * @return JSON array containing books and progress information
     */
    nlohmann::json get_user_books_with_progress(long user_id);

    /**
     * @brief Get user's reading progress for a specific book
     * @param user_id User ID
     * @param book_id Book ID
     * @return JSON object with progress data, or null if no progress found
     */
    nlohmann::json get_user_book_progress(long user_id, long book_id);

    /**
     * @brief Retrieves all books in the library
     * @return JSON array containing all books information
     */
    nlohmann::json get_all_books();

    /**
     * @brief Checks if database connection is valid
     * @return true if connection is active, false otherwise
     */
    bool is_connected() const;
};

#endif // DATABASE_H
