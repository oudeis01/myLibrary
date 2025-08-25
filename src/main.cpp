/**
 * @file main.cpp
 * @brief Main entry point for MyLibrary server application
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include <iostream>
#include <string>
#include <signal.h>
#include "http_server.h"

// Global server instance for signal handling
std::unique_ptr<HttpServer> global_server;

/**
 * @brief Signal handler for graceful shutdown
 * @param signal Signal number received
 */
void signal_handler(int signal) {
    std::cout << "\nReceived signal " << signal << ". Shutting down gracefully..." << std::endl;
    if (global_server) {
        global_server->stop();
        global_server.reset();
    }
    exit(0);
}

/**
 * @brief Displays usage information
 * @param program_name Name of the program executable
 */
void show_usage(const char* program_name) {
    std::cout << "Usage: " << program_name << " [options]" << std::endl;
    std::cout << "Options:" << std::endl;
    std::cout << "  --port PORT          Server port (default: 8080)" << std::endl;
    std::cout << "  --db-host HOST       Database host (default: localhost)" << std::endl;
    std::cout << "  --db-port PORT       Database port (default: 5432)" << std::endl;
    std::cout << "  --db-name NAME       Database name (default: mylibrary_db)" << std::endl;
    std::cout << "  --db-user USER       Database user (default: mylibrary_user)" << std::endl;
    std::cout << "  --db-password PASS   Database password (default: your_password_here)" << std::endl;
    std::cout << "  --books-dir DIR      Books storage directory (default: ./books)" << std::endl;
    std::cout << "  --help               Show this help message" << std::endl;
}

/**
 * @brief Parses command line arguments
 * @param argc Argument count
 * @param argv Argument values
 * @param config Configuration struct to populate
 * @return true if parsing successful, false otherwise
 */
struct ServerConfig {
    int port = 8080;
    std::string db_host = "localhost";
    int db_port = 5432;
    std::string db_name = "mylibrary_db";
    std::string db_user = "mylibrary_user";
    std::string db_password = "your_password_here";
    std::string books_dir = "./books";
};

bool parse_arguments(int argc, char* argv[], ServerConfig& config) {
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        
        if (arg == "--help") {
            show_usage(argv[0]);
            return false;
        } else if (arg == "--port" && i + 1 < argc) {
            config.port = std::stoi(argv[++i]);
        } else if (arg == "--db-host" && i + 1 < argc) {
            config.db_host = argv[++i];
        } else if (arg == "--db-port" && i + 1 < argc) {
            config.db_port = std::stoi(argv[++i]);
        } else if (arg == "--db-name" && i + 1 < argc) {
            config.db_name = argv[++i];
        } else if (arg == "--db-user" && i + 1 < argc) {
            config.db_user = argv[++i];
        } else if (arg == "--db-password" && i + 1 < argc) {
            config.db_password = argv[++i];
        } else if (arg == "--books-dir" && i + 1 < argc) {
            config.books_dir = argv[++i];
        } else {
            std::cerr << "Unknown argument: " << arg << std::endl;
            show_usage(argv[0]);
            return false;
        }
    }
    return true;
}

/**
 * @brief Main function - entry point of the application
 * @param argc Command line argument count
 * @param argv Command line argument values
 * @return Exit status (0 for success, non-zero for error)
 */
int main(int argc, char* argv[]) {
    std::cout << "MyLibrary Server v0.1.0" << std::endl;
    std::cout << "Digital Book Management System" << std::endl;
    std::cout << "=============================" << std::endl;
    
    // Parse command line arguments
    ServerConfig config;
    if (!parse_arguments(argc, argv, config)) {
        return 1;
    }
    
    // Set up signal handlers for graceful shutdown
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    try {
        // Build database connection string
        std::string db_connection_string = 
            "dbname=" + config.db_name + 
            " user=" + config.db_user + 
            " password=" + config.db_password + 
            " host=" + config.db_host + 
            " port=" + std::to_string(config.db_port);
        
        std::cout << "Initializing server with configuration:" << std::endl;
        std::cout << "  Server port: " << config.port << std::endl;
        std::cout << "  Database: " << config.db_host << ":" << config.db_port << "/" << config.db_name << std::endl;
        std::cout << "  Books directory: " << config.books_dir << std::endl;
        std::cout << std::endl;
        
        // Create and start the HTTP server
        global_server = std::make_unique<HttpServer>(
            db_connection_string, 
            config.books_dir, 
            config.port
        );
        
        std::cout << "Starting server..." << std::endl;
        if (!global_server->start()) {
            std::cerr << "Failed to start server on port " << config.port << std::endl;
            return 1;
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Server error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}