/**
 * @file book_manager.cpp
 * @brief Implementation of BookManager class for book file operations
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include "book_manager.h"
#include <filesystem>
#include <fstream>
#include <regex>
#include <chrono>
#include <random>
#include <algorithm>
#include <cctype>

namespace fs = std::filesystem;

BookManager::BookManager(const std::string& books_dir) : books_directory(books_dir) {
    ensure_books_directory_exists();
}

BookInfo BookManager::save_uploaded_book(const std::string& file_content, 
                                        const std::string& original_filename,
                                        const std::string& content_type) {
    // Validate file type
    std::string file_type = get_file_type(original_filename);
    if (!is_supported_format("." + file_type)) {
        throw std::runtime_error("Unsupported file format: " + file_type);
    }
    
    // Validate file content
    if (!validate_file_content(file_content, file_type)) {
        throw std::runtime_error("File content does not match declared type");
    }
    
    // Generate unique filename
    std::string unique_filename = generate_unique_filename(original_filename);
    std::string file_path = get_book_file_path(unique_filename);
    
    // Save file to disk
    try {
        std::ofstream file(file_path, std::ios::binary);
        if (!file.is_open()) {
            throw std::runtime_error("Failed to create file: " + file_path);
        }
        
        file.write(file_content.c_str(), file_content.size());
        file.close();
        
        if (!fs::exists(file_path)) {
            throw std::runtime_error("File was not saved properly");
        }
        
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to save file: " + std::string(e.what()));
    }
    
    // Extract basic metadata
    BookInfo book_info;
    book_info.file_path = file_path;
    book_info.file_type = file_type;
    book_info.file_size = file_content.size();
    
    // For MVP, use filename as title and empty author
    // Future versions can implement proper metadata extraction
    std::string base_name = fs::path(original_filename).stem().string();
    book_info.title = base_name;
    book_info.author = "";
    
    // Try to parse author and title from filename if it follows common patterns
    // Pattern: "Author - Title.ext" or "Title by Author.ext"
    std::regex author_title_pattern1(R"((.+?)\s*-\s*(.+))");
    std::regex author_title_pattern2(R"((.+?)\s+by\s+(.+))");
    
    std::smatch match;
    if (std::regex_match(base_name, match, author_title_pattern1)) {
        book_info.author = match[1].str();
        book_info.title = match[2].str();
    } else if (std::regex_match(base_name, match, author_title_pattern2)) {
        book_info.title = match[1].str();
        book_info.author = match[2].str();
    }
    
    // Trim whitespace
    book_info.title.erase(0, book_info.title.find_first_not_of(" \t"));
    book_info.title.erase(book_info.title.find_last_not_of(" \t") + 1);
    book_info.author.erase(0, book_info.author.find_first_not_of(" \t"));
    book_info.author.erase(book_info.author.find_last_not_of(" \t") + 1);
    
    return book_info;
}

bool BookManager::is_supported_format(const std::string& file_extension) {
    std::string ext = file_extension;
    std::transform(ext.begin(), ext.end(), ext.begin(), ::tolower);
    
    return ext == ".epub" || ext == ".pdf" || ext == ".cbz" || ext == ".cbr";
}

nlohmann::json BookManager::extract_metadata(const std::string& file_path, 
                                            const std::string& file_type) {
    nlohmann::json metadata;
    
    try {
        // Get basic file information
        if (fs::exists(file_path)) {
            auto file_size = fs::file_size(file_path);
            auto last_write_time = fs::last_write_time(file_path);
            
            metadata["file_size"] = file_size;
            metadata["file_type"] = file_type;
            metadata["last_modified"] = std::chrono::duration_cast<std::chrono::seconds>(
                last_write_time.time_since_epoch()).count();
        }
        
        // For MVP, we only extract basic file information
        // Future versions can implement proper metadata extraction for each format:
        // - EPUB: Parse META-INF/container.xml and OPF file
        // - PDF: Parse PDF metadata dictionary
        // - CBZ/CBR: Extract from ComicInfo.xml if present
        
        metadata["extraction_status"] = "basic";
        metadata["full_metadata_available"] = false;
        
    } catch (const std::exception& e) {
        metadata["error"] = e.what();
        metadata["extraction_status"] = "failed";
    }
    
    return metadata;
}

std::string BookManager::generate_unique_filename(const std::string& original_filename) {
    // Get file extension
    fs::path original_path(original_filename);
    std::string extension = original_path.extension().string();
    std::string base_name = original_path.stem().string();
    
    // Generate timestamp
    auto now = std::chrono::system_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
    
    // Generate random suffix
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(1000, 9999);
    int random_suffix = dis(gen);
    
    // Clean base name (remove invalid characters)
    std::string clean_base = base_name;
    std::regex invalid_chars(R"([<>:"/\\|?*])");
    clean_base = std::regex_replace(clean_base, invalid_chars, "_");
    
    // Limit length
    if (clean_base.length() > 50) {
        clean_base = clean_base.substr(0, 50);
    }
    
    return clean_base + "_" + std::to_string(timestamp) + "_" + std::to_string(random_suffix) + extension;
}

std::string BookManager::get_file_type(const std::string& filename) {
    fs::path file_path(filename);
    std::string extension = file_path.extension().string();
    std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
    
    if (extension == ".epub") return "epub";
    if (extension == ".pdf") return "pdf";
    if (extension == ".cbz") return "cbz";
    if (extension == ".cbr") return "cbr";
    
    return "unknown";
}

bool BookManager::validate_file_content(const std::string& file_content, 
                                       const std::string& declared_type) {
    if (file_content.empty()) {
        return false;
    }
    
    // Check file signatures (magic numbers)
    if (declared_type == "pdf") {
        // PDF files start with "%PDF-"
        return file_content.substr(0, 5) == "%PDF-";
    }
    
    if (declared_type == "epub" || declared_type == "cbz") {
        // EPUB and CBZ are ZIP files, check ZIP signature
        // ZIP files start with "PK" (0x504B)
        return file_content.size() >= 2 && 
               static_cast<unsigned char>(file_content[0]) == 0x50 && 
               static_cast<unsigned char>(file_content[1]) == 0x4B;
    }
    
    if (declared_type == "cbr") {
        // CBR files are RAR archives, check RAR signature
        // RAR files start with "Rar!" (0x526172211A0700)
        return file_content.size() >= 4 && 
               file_content.substr(0, 4) == "Rar!";
    }
    
    // For unknown types, assume valid (conservative approach for MVP)
    return true;
}

void BookManager::ensure_books_directory_exists() {
    try {
        if (!fs::exists(books_directory)) {
            fs::create_directories(books_directory);
        }
        
        if (!fs::is_directory(books_directory)) {
            throw std::runtime_error("Books path exists but is not a directory: " + books_directory);
        }
        
        // Check write permissions by creating a temporary file
        std::string test_file = books_directory + "/.write_test";
        std::ofstream test(test_file);
        if (!test.is_open()) {
            throw std::runtime_error("No write permission for books directory: " + books_directory);
        }
        test.close();
        fs::remove(test_file);
        
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to setup books directory: " + std::string(e.what()));
    }
}

std::string BookManager::get_book_file_path(const std::string& filename) const {
    fs::path books_path(books_directory);
    fs::path file_path = books_path / filename;
    return file_path.string();
}
