/**
 * @file library_scanner.cpp
 * @brief Implementation of LibraryScanner class for background scanning with file sync
 * @author MyLibrary Team
 * @version 1.0
 * @date 2025-08-26
 */

#include "library_scanner.h"
#include "database.h"
#include "book_manager.h"
#include <filesystem>
#include <iostream>
#include <algorithm>

namespace fs = std::filesystem;

LibraryScanner::LibraryScanner(Database* db, BookManager* bm) 
    : database(db), book_manager(bm) {
    if (!database || !book_manager) {
        throw std::invalid_argument("LibraryScanner requires valid Database and BookManager instances");
    }
    std::cout << "LibraryScanner initialized successfully" << std::endl;
}

LibraryScanner::~LibraryScanner() {
    if (is_scanning.load()) {
        std::cout << "LibraryScanner destructor: stopping scan..." << std::endl;
        stop_scan();
    }
}

bool LibraryScanner::start_scan(const std::string& books_directory) {
    return start_sync_scan(books_directory, false);  // 기본 스캔은 고아 정리 안함
}

bool LibraryScanner::start_sync_scan(const std::string& books_directory, bool cleanup_orphaned) {
    if (is_scanning.load()) {
        std::cout << "Scan already in progress" << std::endl;
        return false;
    }
    
    if (!fs::exists(books_directory)) {
        std::cout << "Books directory does not exist: " << books_directory << std::endl;
        return false;
    }
    
    // Reset counters
    current_progress.store(0);
    total_books.store(0);
    processed_books.store(0);
    orphaned_cleaned.store(0);
    error_log.clear();
    scan_start_time = std::chrono::system_clock::now();
    
    // Start worker thread
    is_scanning.store(true);
    should_stop.store(false);
    
    // 기존 스레드가 joinable하면 먼저 정리
    if (worker_thread.joinable()) {
        worker_thread.join();
    }
    
    worker_thread = std::thread(&LibraryScanner::scan_worker, this, books_directory, cleanup_orphaned);
    
    std::cout << "LibraryScanner: " << (cleanup_orphaned ? "Sync scan" : "Regular scan") 
              << " started for directory: " << books_directory << std::endl;
    return true;
}

void LibraryScanner::stop_scan() {
    if (!is_scanning.load()) {
        return;
    }
    
    std::cout << "LibraryScanner: requesting scan stop..." << std::endl;
    should_stop.store(true);
    
    if (worker_thread.joinable()) {
        worker_thread.join();
    }
    
    is_scanning.store(false);
    std::cout << "LibraryScanner: scan stopped" << std::endl;
}

void LibraryScanner::scan_worker(const std::string& books_directory, bool cleanup_orphaned) {
    try {
        std::cout << "LibraryScanner worker: starting scan..." << std::endl;
        
        // Step 1: Cleanup orphaned records if requested
        if (cleanup_orphaned) {
            std::lock_guard<std::mutex> lock(progress_mutex);
            current_book_name = "Cleaning orphaned records...";
            
            int cleaned = database->cleanup_orphaned_books();
            orphaned_cleaned.store(cleaned);
            
            std::cout << "LibraryScanner: cleaned " << cleaned << " orphaned records" << std::endl;
        }
        
        // Step 2: Scan for new books
        std::vector<std::string> book_files;
        
        // Find all supported book files (including symlinks)
        for (const auto& entry : fs::recursive_directory_iterator(books_directory, 
                                                                  fs::directory_options::follow_directory_symlink)) {
            if (should_stop.load()) {
                std::cout << "LibraryScanner: scan interrupted by user" << std::endl;
                return;
            }
            
            if (entry.is_regular_file() || (entry.is_symlink() && fs::is_regular_file(entry.symlink_status()))) {
                std::string extension = entry.path().extension().string();
                std::transform(extension.begin(), extension.end(), extension.begin(), ::tolower);
                
                if (extension == ".epub" || extension == ".pdf" || extension == ".cbz") {
                    book_files.push_back(entry.path().string());
                }
            }
        }
        
        total_books.store(static_cast<int>(book_files.size()));
        
        std::cout << "LibraryScanner: found " << book_files.size() << " book files to process" << std::endl;
        
        // Step 3: Process each book file
        int processed = 0;
        for (const std::string& book_path : book_files) {
            if (should_stop.load()) {
                std::cout << "LibraryScanner: scan interrupted by user" << std::endl;
                return;
            }
            
            try {
                // Update progress
                update_progress(processed + 1, static_cast<int>(book_files.size()), 
                              fs::path(book_path).filename().string());
                
                // Check if book already exists in database
                long existing_book_id = database->get_book_id(book_path);
                if (existing_book_id == -1) {
                    // New book found but not in database
                    // Note: This scanner focuses on cleanup, not adding new books
                    std::cout << "LibraryScanner: found new book not in database: " << book_path << std::endl;
                    std::cout << "LibraryScanner: (new book addition should be done via upload API)" << std::endl;
                } else {
                    // Book already exists - this is expected
                    std::cout << "LibraryScanner: verified existing book: " << book_path << std::endl;
                }
                
                processed++;
                processed_books.store(processed);
                
            } catch (const std::exception& e) {
                std::string error_msg = "Error processing " + book_path + ": " + e.what();
                std::cout << "LibraryScanner: " << error_msg << std::endl;
                
                std::lock_guard<std::mutex> lock(progress_mutex);
                error_log.push_back(error_msg);
            }
            
            // Small delay to prevent overwhelming the system
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
        
        auto end_time = std::chrono::system_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::seconds>(end_time - scan_start_time);
        
        std::cout << "LibraryScanner: scan completed in " << duration.count() << " seconds" << std::endl;
        std::cout << "LibraryScanner: processed " << processed << " books, cleaned " 
                  << orphaned_cleaned.load() << " orphaned records" << std::endl;
        
    } catch (const std::exception& e) {
        std::cout << "LibraryScanner worker error: " << e.what() << std::endl;
        std::lock_guard<std::mutex> lock(progress_mutex);
        error_log.push_back("Scanner error: " + std::string(e.what()));
    }
    
    is_scanning.store(false);
}

void LibraryScanner::update_progress(int current, int total, const std::string& book_name) {
    std::lock_guard<std::mutex> lock(progress_mutex);
    
    current_progress.store(current);
    current_book_name = book_name;
    
    if (total > 0) {
        int percentage = (current * 100) / total;
        // Progress is already updated via processed_books atomic
    }
}

ScanStatus LibraryScanner::get_status() const {
    std::lock_guard<std::mutex> lock(progress_mutex);
    
    ScanStatus status;
    status.is_scanning = is_scanning.load();
    status.processed_books = processed_books.load();
    status.total_books = total_books.load();
    status.orphaned_cleaned = orphaned_cleaned.load();
    status.current_book = current_book_name;
    status.errors = error_log;
    status.start_time = scan_start_time;
    
    if (status.total_books > 0) {
        status.progress_percentage = (status.processed_books * 100) / status.total_books;
    }
    
    return status;
}

int LibraryScanner::cleanup_orphaned_records() {
    if (is_scanning.load()) {
        std::cout << "Cannot cleanup orphaned records while scanning" << std::endl;
        return 0;
    }
    
    return database->cleanup_orphaned_books();
}