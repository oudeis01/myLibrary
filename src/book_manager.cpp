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
#include <iostream>
#include <minizip/unzip.h>
#include <tinyxml2.h>

namespace fs = std::filesystem;

BookManager::BookManager(const std::string& books_dir) : books_directory(books_dir) {
    thumbnails_directory = books_dir + "/thumbnails";
    ensure_books_directory_exists();
    ensure_thumbnails_directory_exists();
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
    
    // Initialize metadata extraction
    book_info.metadata_extracted = false;
    book_info.extraction_error = "";
    
    try {
        // Extract comprehensive metadata based on file type
        if (file_type == "epub") {
            book_info.metadata = extract_epub_metadata(file_path);
        } else if (file_type == "pdf") {
            book_info.metadata = extract_pdf_metadata(file_path);
        } else if (file_type == "cbz" || file_type == "cbr") {
            book_info.metadata = extract_comic_metadata(file_path);
        } else {
            // Fallback to filename parsing
            std::string base_name = fs::path(original_filename).stem().string();
            book_info.metadata.title = base_name;
            book_info.metadata.author = "";
            
            // Try to parse author and title from filename
            std::regex author_title_pattern1(R"((.+?)\s*-\s*(.+))");
            std::regex author_title_pattern2(R"((.+?)\s+by\s+(.+))");
            
            std::smatch match;
            if (std::regex_match(base_name, match, author_title_pattern1)) {
                book_info.metadata.author = match[1].str();
                book_info.metadata.title = match[2].str();
            } else if (std::regex_match(base_name, match, author_title_pattern2)) {
                book_info.metadata.title = match[1].str();
                book_info.metadata.author = match[2].str();
            }
        }
        
        // Use extracted metadata for book info
        book_info.title = book_info.metadata.title.empty() ? 
            fs::path(original_filename).stem().string() : book_info.metadata.title;
        book_info.author = book_info.metadata.author;
        
        // Generate thumbnail from extracted cover or create placeholder
        std::string thumbnail_extension;
        if (!book_info.metadata.cover_image.empty()) {
            // Use appropriate extension based on cover format
            if (book_info.metadata.cover_format.find("jpeg") != std::string::npos || 
                book_info.metadata.cover_format.find("jpg") != std::string::npos) {
                thumbnail_extension = ".jpg";
            } else if (book_info.metadata.cover_format.find("png") != std::string::npos) {
                thumbnail_extension = ".png";
            } else {
                thumbnail_extension = ".jpg"; // Default to JPEG
            }
        } else {
            thumbnail_extension = ".svg"; // SVG placeholder
        }
        
        std::string thumbnail_filename = "thumb_" + unique_filename + thumbnail_extension;
        std::string thumbnail_path = get_thumbnails_directory() + "/" + thumbnail_filename;
        
        if (generate_thumbnail(file_path, file_type, book_info.metadata.cover_image, thumbnail_path)) {
            book_info.thumbnail_path = thumbnail_path;
        }
        
        book_info.metadata_extracted = true;
        
    } catch (const std::exception& e) {
        book_info.extraction_error = e.what();
        book_info.metadata_extracted = false;
        
        // Fallback to basic filename parsing
        std::string base_name = fs::path(original_filename).stem().string();
        book_info.title = base_name;
        book_info.author = "";
        
        // Try to parse author and title from filename
        std::regex author_title_pattern1(R"((.+?)\s*-\s*(.+))");
        std::smatch match;
        if (std::regex_match(base_name, match, author_title_pattern1)) {
            book_info.author = match[1].str();
            book_info.title = match[2].str();
        }
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

std::string BookManager::get_thumbnails_directory() const {
    return thumbnails_directory;
}

void BookManager::ensure_thumbnails_directory_exists() {
    try {
        if (!fs::exists(thumbnails_directory)) {
            fs::create_directories(thumbnails_directory);
        }
        
        if (!fs::is_directory(thumbnails_directory)) {
            throw std::runtime_error("Thumbnails path exists but is not a directory: " + thumbnails_directory);
        }
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to setup thumbnails directory: " + std::string(e.what()));
    }
}

BookMetadata BookManager::extract_epub_metadata(const std::string& file_path) {
    BookMetadata metadata;
    
    // For now, implement basic EPUB metadata extraction
    // This is a simplified implementation
    try {
        // Read the EPUB file
        std::ifstream file(file_path, std::ios::binary);
        if (!file.is_open()) {
            throw std::runtime_error("Cannot open EPUB file");
        }
        
        fs::path epub_path(file_path);
        std::string base_name = epub_path.stem().string();
        
        // Extract title from filename as fallback
        std::string clean_title = base_name;
        std::regex timestamp_pattern(R"(_\d+_\d+)");
        clean_title = std::regex_replace(clean_title, timestamp_pattern, "");
        
        std::regex series_pattern1(R"((.+?)-(\d+)$)");
        std::smatch match;
        if (std::regex_match(clean_title, match, series_pattern1)) {
            metadata.title = match[1].str() + " (제" + match[2].str() + "권)";
        } else {
            metadata.title = clean_title;
        }
        
        // Try to extract metadata from EPUB file
        unzFile epub_file = unzOpen(file_path.c_str());
        if (epub_file != nullptr) {
            // Read container.xml to find OPF file location
            std::string opf_path = extract_opf_path_from_container(epub_file);
            if (!opf_path.empty()) {
                extract_metadata_from_opf(epub_file, opf_path, metadata);
                extract_cover_image_from_epub(epub_file, opf_path, metadata);
            }
            unzClose(epub_file);
        }
        
        // Set default values for any missing fields
        if (metadata.author.empty()) metadata.author = "";
        if (metadata.description.empty()) metadata.description = "";
        if (metadata.publisher.empty()) metadata.publisher = "";
        if (metadata.isbn.empty()) metadata.isbn = "";
        if (metadata.language.empty()) metadata.language = "ko";
        if (metadata.page_count == 0) metadata.page_count = 0;
        
        // Clean up title
        std::replace(metadata.title.begin(), metadata.title.end(), '_', ' ');
        metadata.title.erase(0, metadata.title.find_first_not_of(" \t"));
        metadata.title.erase(metadata.title.find_last_not_of(" \t") + 1);
        
    } catch (const std::exception& e) {
        throw std::runtime_error("EPUB metadata extraction failed: " + std::string(e.what()));
    }
    
    return metadata;
}

BookMetadata BookManager::extract_pdf_metadata(const std::string& file_path) {
    BookMetadata metadata;
    
    // Basic PDF metadata extraction
    try {
        fs::path pdf_path(file_path);
        std::string base_name = pdf_path.stem().string();
        
        // Extract title from filename
        std::regex title_pattern(R"((.+?)(?:_\d+_\d+)?)");
        std::smatch match;
        if (std::regex_match(base_name, match, title_pattern)) {
            metadata.title = match[1].str();
        } else {
            metadata.title = base_name;
        }
        
        // Set default values
        metadata.author = "";
        metadata.description = "";
        metadata.publisher = "";
        metadata.isbn = "";
        metadata.language = "en";
        metadata.page_count = 0;
        metadata.cover_format = "";
        
        // Clean up title
        std::replace(metadata.title.begin(), metadata.title.end(), '_', ' ');
        
    } catch (const std::exception& e) {
        throw std::runtime_error("PDF metadata extraction failed: " + std::string(e.what()));
    }
    
    return metadata;
}

BookMetadata BookManager::extract_comic_metadata(const std::string& file_path) {
    BookMetadata metadata;
    
    // Basic comic metadata extraction
    try {
        fs::path comic_path(file_path);
        std::string base_name = comic_path.stem().string();
        
        // Extract title from filename
        std::regex title_pattern(R"((.+?)(?:_\d+_\d+)?)");
        std::smatch match;
        if (std::regex_match(base_name, match, title_pattern)) {
            metadata.title = match[1].str();
        } else {
            metadata.title = base_name;
        }
        
        // Set default values
        metadata.author = "";
        metadata.description = "";
        metadata.publisher = "";
        metadata.isbn = "";
        metadata.language = "en";
        metadata.page_count = 0;
        metadata.cover_format = "";
        
        // Clean up title
        std::replace(metadata.title.begin(), metadata.title.end(), '_', ' ');
        
    } catch (const std::exception& e) {
        throw std::runtime_error("Comic metadata extraction failed: " + std::string(e.what()));
    }
    
    return metadata;
}

bool BookManager::generate_thumbnail(const std::string& file_path,
                                   const std::string& file_type,
                                   const std::vector<unsigned char>& cover_image,
                                   const std::string& output_path) {
    try {
        if (!cover_image.empty()) {
            // We have actual cover image data - save it as thumbnail
            std::string extension = fs::path(output_path).extension().string();
            
            // Determine output format based on cover format and desired extension  
            if (extension == ".jpg" || extension == ".jpeg") {
                // Save as JPEG thumbnail (for now just copy the data)
                std::ofstream thumbnail_file(output_path, std::ios::binary);
                if (!thumbnail_file.is_open()) {
                    return false;
                }
                
                thumbnail_file.write(reinterpret_cast<const char*>(cover_image.data()), cover_image.size());
                thumbnail_file.close();
                return true;
            } else {
                // Default to copying the image data as-is
                std::ofstream thumbnail_file(output_path, std::ios::binary);
                if (!thumbnail_file.is_open()) {
                    return false;
                }
                
                thumbnail_file.write(reinterpret_cast<const char*>(cover_image.data()), cover_image.size());
                thumbnail_file.close();
                return true;
            }
        } else {
            // No cover image - create SVG placeholder
            std::ofstream thumbnail_file(output_path);
            if (!thumbnail_file.is_open()) {
                return false;
            }
            
            // Write a simple SVG placeholder
            thumbnail_file << R"(<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="300" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
  <text x="100" y="150" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#666">📖</text>
  <text x="100" y="200" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#888">)" << file_type << R"(</text>
</svg>)";
            
            thumbnail_file.close();
            return true;
        }
        
    } catch (const std::exception& e) {
        return false;
    }
}

// Helper function to extract OPF path from container.xml
std::string BookManager::extract_opf_path_from_container(unzFile epub_file) {
    // Look for META-INF/container.xml
    if (unzLocateFile(epub_file, "META-INF/container.xml", 0) != UNZ_OK) {
        return "";
    }
    
    if (unzOpenCurrentFile(epub_file) != UNZ_OK) {
        return "";
    }
    
    // Read container.xml
    char buffer[8192];
    int bytes_read = unzReadCurrentFile(epub_file, buffer, sizeof(buffer) - 1);
    unzCloseCurrentFile(epub_file);
    
    if (bytes_read <= 0) {
        return "";
    }
    
    buffer[bytes_read] = '\0';
    
    // Parse XML to find OPF file path
    tinyxml2::XMLDocument doc;
    if (doc.Parse(buffer) != tinyxml2::XML_SUCCESS) {
        return "";
    }
    
    tinyxml2::XMLElement* rootfile = doc.FirstChildElement("container")
                                       ->FirstChildElement("rootfiles")
                                       ->FirstChildElement("rootfile");
    
    if (rootfile && rootfile->Attribute("full-path")) {
        return rootfile->Attribute("full-path");
    }
    
    return "";
}

// Helper function to extract metadata from OPF file
void BookManager::extract_metadata_from_opf(unzFile epub_file, const std::string& opf_path, BookMetadata& metadata) {
    if (unzLocateFile(epub_file, opf_path.c_str(), 0) != UNZ_OK) {
        return;
    }
    
    if (unzOpenCurrentFile(epub_file) != UNZ_OK) {
        return;
    }
    
    // Read OPF file
    std::string content;
    char buffer[8192];
    int bytes_read;
    
    while ((bytes_read = unzReadCurrentFile(epub_file, buffer, sizeof(buffer))) > 0) {
        content.append(buffer, bytes_read);
    }
    
    unzCloseCurrentFile(epub_file);
    
    // Parse OPF XML
    tinyxml2::XMLDocument doc;
    if (doc.Parse(content.c_str()) != tinyxml2::XML_SUCCESS) {
        return;
    }
    
    tinyxml2::XMLElement* package = doc.FirstChildElement("package");
    if (!package) return;
    
    tinyxml2::XMLElement* metadata_elem = package->FirstChildElement("metadata");
    if (!metadata_elem) return;
    
    // Extract title
    tinyxml2::XMLElement* title = metadata_elem->FirstChildElement("title");
    if (title && title->GetText()) {
        metadata.title = title->GetText();
    }
    
    // Extract author
    tinyxml2::XMLElement* creator = metadata_elem->FirstChildElement("creator");
    if (creator && creator->GetText()) {
        metadata.author = creator->GetText();
    }
    
    // Extract description
    tinyxml2::XMLElement* description = metadata_elem->FirstChildElement("description");
    if (description && description->GetText()) {
        metadata.description = description->GetText();
    }
    
    // Extract publisher
    tinyxml2::XMLElement* publisher = metadata_elem->FirstChildElement("publisher");
    if (publisher && publisher->GetText()) {
        metadata.publisher = publisher->GetText();
    }
    
    // Extract language
    tinyxml2::XMLElement* language = metadata_elem->FirstChildElement("language");
    if (language && language->GetText()) {
        metadata.language = language->GetText();
    }
}

// Helper function to extract cover image from EPUB
void BookManager::extract_cover_image_from_epub(unzFile epub_file, const std::string& opf_path, BookMetadata& metadata) {
    // Find cover image in manifest
    if (unzLocateFile(epub_file, opf_path.c_str(), 0) != UNZ_OK) {
        return;
    }
    
    if (unzOpenCurrentFile(epub_file) != UNZ_OK) {
        return;
    }
    
    std::string content;
    char buffer[8192];
    int bytes_read;
    
    while ((bytes_read = unzReadCurrentFile(epub_file, buffer, sizeof(buffer))) > 0) {
        content.append(buffer, bytes_read);
    }
    
    unzCloseCurrentFile(epub_file);
    
    tinyxml2::XMLDocument doc;
    if (doc.Parse(content.c_str()) != tinyxml2::XML_SUCCESS) {
        return;
    }
    
    // Look for cover in manifest
    tinyxml2::XMLElement* package = doc.FirstChildElement("package");
    if (!package) return;
    
    tinyxml2::XMLElement* manifest = package->FirstChildElement("manifest");
    if (!manifest) return;
    
    std::string cover_href;
    std::string cover_media_type;
    
    // Look for cover meta tag
    tinyxml2::XMLElement* metadata_elem = package->FirstChildElement("metadata");
    if (metadata_elem) {
        for (tinyxml2::XMLElement* meta = metadata_elem->FirstChildElement("meta"); 
             meta; meta = meta->NextSiblingElement("meta")) {
            if (meta->Attribute("name") && 
                std::string(meta->Attribute("name")) == "cover" && 
                meta->Attribute("content")) {
                
                std::string cover_id = meta->Attribute("content");
                
                // Find item with this ID
                for (tinyxml2::XMLElement* item = manifest->FirstChildElement("item");
                     item; item = item->NextSiblingElement("item")) {
                    if (item->Attribute("id") && 
                        std::string(item->Attribute("id")) == cover_id &&
                        item->Attribute("href") &&
                        item->Attribute("media-type")) {
                        cover_href = item->Attribute("href");
                        cover_media_type = item->Attribute("media-type");
                        break;
                    }
                }
                break;
            }
        }
    }
    
    if (cover_href.empty()) {
        // Fallback: look for common cover file names
        std::vector<std::string> cover_names = {"cover.jpg", "cover.png", "cover.jpeg", "Cover.jpg", "Cover.png"};
        for (const auto& name : cover_names) {
            if (unzLocateFile(epub_file, name.c_str(), 0) == UNZ_OK) {
                cover_href = name;
                cover_media_type = name.ends_with(".png") ? "image/png" : "image/jpeg";
                break;
            }
        }
    }
    
    if (!cover_href.empty()) {
        // Calculate relative path from OPF directory
        fs::path opf_dir = fs::path(opf_path).parent_path();
        std::string full_cover_path = (opf_dir / cover_href).string();
        
        // Extract cover image data
        if (unzLocateFile(epub_file, full_cover_path.c_str(), 0) == UNZ_OK) {
            if (unzOpenCurrentFile(epub_file) == UNZ_OK) {
                std::vector<unsigned char> image_data;
                char buffer[4096];
                int bytes_read;
                
                while ((bytes_read = unzReadCurrentFile(epub_file, buffer, sizeof(buffer))) > 0) {
                    image_data.insert(image_data.end(), buffer, buffer + bytes_read);
                }
                
                unzCloseCurrentFile(epub_file);
                
                metadata.cover_image = std::move(image_data);
                metadata.cover_format = cover_media_type;
            }
        }
    }
}
