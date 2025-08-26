/**
 * @file library_scanner.h
 * @brief Library scanning and metadata extraction system with file sync
 * @author MyLibrary Team
 * @version 1.0
 * @date 2025-08-26
 */

#ifndef LIBRARY_SCANNER_H
#define LIBRARY_SCANNER_H

#include <thread>
#include <atomic>
#include <mutex>
#include <string>
#include <vector>
#include <memory>
#include <chrono>

class Database;
class BookManager;

/**
 * @struct ScanStatus
 * @brief Current scanning operation status with orphaned cleanup info
 */
struct ScanStatus {
    bool is_scanning = false;
    int progress_percentage = 0;
    std::string current_book = "";
    int total_books = 0;
    int processed_books = 0;
    int orphaned_cleaned = 0;  // NEW: 정리된 고아 레코드 수
    std::vector<std::string> errors;
    std::chrono::system_clock::time_point start_time;
};

/**
 * @class LibraryScanner
 * @brief Handles background library scanning, metadata extraction, and file synchronization
 */
class LibraryScanner {
private:
    std::thread worker_thread;
    std::atomic<bool> is_scanning{false};
    std::atomic<bool> should_stop{false};
    std::atomic<int> current_progress{0};
    std::atomic<int> total_books{0};
    std::atomic<int> processed_books{0};
    std::atomic<int> orphaned_cleaned{0};  // NEW: 정리된 고아 레코드 카운터
    std::string current_book_name;
    std::vector<std::string> error_log;
    mutable std::mutex progress_mutex;
    std::chrono::system_clock::time_point scan_start_time;
    
    Database* database;
    BookManager* book_manager;
    
    /**
     * @brief Worker thread function for scanning
     * @param books_directory Directory containing book files
     * @param cleanup_orphaned Whether to cleanup orphaned records
     */
    void scan_worker(const std::string& books_directory, bool cleanup_orphaned);
    
    /**
     * @brief Update scanning progress (thread-safe)
     * @param current Current book index
     * @param total Total number of books
     * @param book_name Current book being processed
     */
    void update_progress(int current, int total, const std::string& book_name);

public:
    /**
     * @brief Constructor
     * @param db Database instance
     * @param bm BookManager instance
     */
    LibraryScanner(Database* db, BookManager* bm);
    
    /**
     * @brief Destructor - ensures proper cleanup
     */
    ~LibraryScanner();
    
    /**
     * @brief Start scanning operation in background thread
     * @param books_directory Directory containing book files
     * @return true if scan started successfully, false if already scanning
     */
    bool start_scan(const std::string& books_directory);
    
    /**
     * @brief Start scanning with file system synchronization
     * @param books_directory Directory containing book files
     * @param cleanup_orphaned Whether to cleanup orphaned records (default: true)
     * @return true if scan started successfully, false if already scanning
     */
    bool start_sync_scan(const std::string& books_directory, bool cleanup_orphaned = true);
    
    /**
     * @brief Request scan operation to stop
     */
    void stop_scan();
    
    /**
     * @brief Get current scanning status (thread-safe)
     * @return ScanStatus Current status
     */
    ScanStatus get_status() const;
    
    /**
     * @brief Check if currently scanning
     * @return true if scan operation is active
     */
    bool is_scan_active() const { return is_scanning.load(); }
    
    /**
     * @brief Cleanup orphaned records only (no file scanning)
     * @return Number of orphaned records cleaned
     */
    int cleanup_orphaned_records();
};

#endif // LIBRARY_SCANNER_H