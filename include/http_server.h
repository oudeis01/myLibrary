/**
 * @file http_server.h
 * @brief HTTP REST API server for MyLibrary application
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#ifndef HTTP_SERVER_H
#define HTTP_SERVER_H

#include <httplib.h>
#include <memory>
#include "database.h"
#include "book_manager.h"

/**
 * @class HttpServer
 * @brief HTTP REST API server for the MyLibrary application
 * 
 * This class implements a REST API server that provides endpoints for:
 * - User authentication (login, registration)
 * - Book management (upload, list, metadata)
 * - Reading progress tracking
 * - Static file serving for the web interface
 */
class HttpServer {
private:
    httplib::Server server;                    ///< HTTP server instance
    std::unique_ptr<Database> database;        ///< Database connection
    std::unique_ptr<BookManager> book_manager; ///< Book file manager
    int port;                                  ///< Server port

    /**
     * @brief Sets up all API routes and handlers
     */
    void setup_routes();

    /**
     * @brief Sets up CORS headers for web client compatibility
     */
    void setup_cors();

    /**
     * @brief Validates session token and extracts username
     * @param req HTTP request object
     * @return Username if valid session, empty string otherwise
     */
    std::string validate_session(const httplib::Request& req);

    /**
     * @brief Sends a JSON error response
     * @param res HTTP response object
     * @param status HTTP status code
     * @param message Error message
     */
    void send_error(httplib::Response& res, int status, const std::string& message);

    /**
     * @brief Sends a JSON success response
     * @param res HTTP response object
     * @param data JSON data to send
     */
    void send_success(httplib::Response& res, const nlohmann::json& data);

    // Route handlers
    
    /**
     * @brief Handles user registration requests
     * @param req HTTP request (POST /api/register)
     * @param res HTTP response
     * 
     * Expected JSON body:
     * {
     *   "username": "string",
     *   "password": "string"
     * }
     */
    void handle_register(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles user login requests
     * @param req HTTP request (POST /api/login)
     * @param res HTTP response
     * 
     * Expected JSON body:
     * {
     *   "username": "string",
     *   "password": "string"
     * }
     */
    void handle_login(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles user logout requests
     * @param req HTTP request (POST /api/logout)
     * @param res HTTP response
     */
    void handle_logout(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles book upload requests
     * @param req HTTP request (POST /api/books/upload)
     * @param res HTTP response
     * 
     * Expected multipart form data with:
     * - file: Book file (epub, pdf, cbz)
     * - title: Book title (optional, will be extracted if not provided)
     * - author: Book author (optional, will be extracted if not provided)
     */
    void handle_book_upload(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles requests to list user's books
     * @param req HTTP request (GET /api/books)
     * @param res HTTP response
     */
    void handle_list_books(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles requests to update reading progress
     * @param req HTTP request (PUT /api/books/{book_id}/progress)
     * @param res HTTP response
     * 
     * Expected JSON body:
     * {
     *   "page": number,
     *   "chapter": number,
     *   "progress_percent": number,
     *   "last_position": "string",
     *   "notes": "string"
     * }
     */
    void handle_update_progress(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles requests to get reading progress
     * @param req HTTP request (GET /api/books/{book_id}/progress)
     * @param res HTTP response
     */
    void handle_get_progress(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles requests to download book files
     * @param req HTTP request (GET /api/books/{book_id}/download)
     * @param res HTTP response
     */
    void handle_book_download(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles requests to access book files for reading
     * @param req HTTP request (GET /api/books/{book_id}/file)
     * @param res HTTP response
     */
    void handle_book_file_access(const httplib::Request& req, httplib::Response& res);

    /**
     * @brief Handles health check requests
     * @param req HTTP request (GET /api/health)
     * @param res HTTP response
     */
    void handle_health_check(const httplib::Request& req, httplib::Response& res);

public:
    /**
     * @brief Constructor
     * @param db_connection_string PostgreSQL connection string
     * @param books_directory Directory for storing book files
     * @param server_port Port for the HTTP server
     */
    HttpServer(const std::string& db_connection_string, 
               const std::string& books_directory,
               int server_port = 8080);

    /**
     * @brief Destructor
     */
    ~HttpServer() = default;

    /**
     * @brief Starts the HTTP server
     * @return true if server started successfully, false otherwise
     */
    bool start();

    /**
     * @brief Stops the HTTP server
     */
    void stop();

    /**
     * @brief Gets the port the server is running on
     * @return Server port number
     */
    int get_port() const { return port; }
};

#endif // HTTP_SERVER_H
