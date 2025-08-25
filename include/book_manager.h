/**
 * @file book_manager.h
 * @brief Book file management and metadata extraction for MyLibrary server
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#ifndef BOOK_MANAGER_H
#define BOOK_MANAGER_H

#include <string>
#include <nlohmann/json.hpp>

/**
 * @struct BookInfo
 * @brief Contains basic information about a book file
 */
struct BookInfo {
    std::string title;        ///< Book title
    std::string author;       ///< Book author
    std::string file_type;    ///< File type (epub, pdf, cbz)
    size_t file_size;         ///< File size in bytes
    std::string file_path;    ///< Full path to the stored file
};

/**
 * @class BookManager
 * @brief Manages book file operations and metadata extraction
 * 
 * This class handles file uploads, storage, and basic metadata
 * extraction for supported book formats.
 */
class BookManager {
private:
    std::string books_directory; ///< Directory where books are stored

public:
    /**
     * @brief Constructor
     * @param books_dir Directory path for storing book files
     */
    explicit BookManager(const std::string& books_dir);

    /**
     * @brief Saves an uploaded book file and extracts metadata
     * @param file_content Binary content of the uploaded file
     * @param original_filename Original filename from upload
     * @param content_type MIME type of the uploaded file
     * @return BookInfo struct containing extracted information
     * @throws std::runtime_error if file processing fails
     */
    BookInfo save_uploaded_book(const std::string& file_content, 
                               const std::string& original_filename,
                               const std::string& content_type);

    /**
     * @brief Validates if a file type is supported
     * @param file_extension File extension (e.g., ".epub", ".pdf")
     * @return true if file type is supported, false otherwise
     */
    static bool is_supported_format(const std::string& file_extension);

    /**
     * @brief Extracts basic metadata from a book file
     * @param file_path Path to the book file
     * @param file_type Type of the book file
     * @return JSON object containing extracted metadata
     * @note For MVP, this provides basic file information.
     *       Future versions can implement full metadata extraction.
     */
    static nlohmann::json extract_metadata(const std::string& file_path, 
                                          const std::string& file_type);

    /**
     * @brief Generates a unique filename for storing the book
     * @param original_filename Original filename from upload
     * @return Unique filename for storage
     */
    static std::string generate_unique_filename(const std::string& original_filename);

    /**
     * @brief Determines file type from file extension
     * @param filename Name of the file
     * @return File type string (epub, pdf, cbz, unknown)
     */
    static std::string get_file_type(const std::string& filename);

    /**
     * @brief Validates file content against its declared type
     * @param file_content Binary content of the file
     * @param declared_type Declared file type
     * @return true if content matches declared type, false otherwise
     */
    static bool validate_file_content(const std::string& file_content, 
                                     const std::string& declared_type);

    /**
     * @brief Creates the books directory if it doesn't exist
     * @throws std::runtime_error if directory creation fails
     */
    void ensure_books_directory_exists();

    /**
     * @brief Gets the full path for storing a book file
     * @param filename Name of the file
     * @return Full path for the file
     */
    std::string get_book_file_path(const std::string& filename) const;
};

#endif // BOOK_MANAGER_H
