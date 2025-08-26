/**
 * @file http_server.cpp
 * @brief Implementation of HttpServer class for REST API endpoints
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include "http_server.h"
#include "auth.h"
#include <iostream>
#include <fstream>
#include <filesystem>

namespace fs = std::filesystem;

HttpServer::HttpServer(const std::string& db_connection_string, 
                      const std::string& books_directory,
                      int server_port) : port(server_port) {
    
    // Initialize database connection
    database = std::make_unique<Database>(db_connection_string);
    
    // Initialize book manager
    book_manager = std::make_unique<BookManager>(books_directory);
    
    // Setup server
    setup_cors();
    setup_routes();
    
    std::cout << "HTTP Server initialized on port " << port << std::endl;
}

void HttpServer::setup_cors() {
    // Enable CORS for web client compatibility
    server.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Session-Token");
        return httplib::Server::HandlerResponse::Unhandled;
    });
    
    // Handle OPTIONS requests for CORS preflight
    server.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        return;
    });
}

void HttpServer::setup_routes() {
    // Health check endpoint
    server.Get("/api/health", [this](const httplib::Request& req, httplib::Response& res) {
        handle_health_check(req, res);
    });
    
    // Authentication endpoints
    server.Post("/api/register", [this](const httplib::Request& req, httplib::Response& res) {
        handle_register(req, res);
    });
    
    server.Post("/api/login", [this](const httplib::Request& req, httplib::Response& res) {
        handle_login(req, res);
    });
    
    server.Post("/api/logout", [this](const httplib::Request& req, httplib::Response& res) {
        handle_logout(req, res);
    });
    
    // Book management endpoints
    server.Post("/api/books/upload", [this](const httplib::Request& req, httplib::Response& res) {
        handle_book_upload(req, res);
    });
    
    server.Get("/api/books", [this](const httplib::Request& req, httplib::Response& res) {
        handle_list_books(req, res);
    });
    
    server.Get(R"(/api/books/(\d+)/download)", [this](const httplib::Request& req, httplib::Response& res) {
        handle_book_download(req, res);
    });
    
    // File access endpoint (for reading books)
    server.Get(R"(/api/books/(\d+)/file)", [this](const httplib::Request& req, httplib::Response& res) {
        handle_book_file_access(req, res);
    });
    
    // Thumbnail access endpoint
    server.Get(R"(/api/books/(\d+)/thumbnail)", [this](const httplib::Request& req, httplib::Response& res) {
        handle_book_thumbnail(req, res);
    });
    
    // Progress tracking endpoints
    server.Put(R"(/api/books/(\d+)/progress)", [this](const httplib::Request& req, httplib::Response& res) {
        handle_update_progress(req, res);
    });
    
    server.Get(R"(/api/books/(\d+)/progress)", [this](const httplib::Request& req, httplib::Response& res) {
        handle_get_progress(req, res);
    });
    
    // Serve static files (for web interface)
    server.set_mount_point("/", "./web");
    
    std::cout << "HTTP Server routes configured." << std::endl;
}

std::string HttpServer::validate_session(const httplib::Request& req) {
    std::string token;
    
    // Check for session token in Authorization header
    if (req.has_header("Authorization")) {
        std::string auth_header = req.get_header_value("Authorization");
        if (auth_header.substr(0, 7) == "Bearer ") {
            token = auth_header.substr(7);
        }
    }
    
    // Check for session token in X-Session-Token header
    if (token.empty() && req.has_header("X-Session-Token")) {
        token = req.get_header_value("X-Session-Token");
    }
    
    if (token.empty()) {
        return "";
    }
    
    return Auth::validate_session_token(token);
}

void HttpServer::send_error(httplib::Response& res, int status, const std::string& message) {
    nlohmann::json error_response;
    error_response["success"] = false;
    error_response["error"] = message;
    
    res.status = status;
    res.set_content(error_response.dump(), "application/json");
}

void HttpServer::send_success(httplib::Response& res, const nlohmann::json& data) {
    nlohmann::json success_response;
    success_response["success"] = true;
    success_response["data"] = data;
    
    res.status = 200;
    res.set_content(success_response.dump(), "application/json");
}

void HttpServer::handle_health_check(const httplib::Request& req, httplib::Response& res) {
    nlohmann::json health_data;
    health_data["status"] = "ok";
    health_data["database_connected"] = database->is_connected();
    health_data["timestamp"] = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    
    send_success(res, health_data);
}

void HttpServer::handle_register(const httplib::Request& req, httplib::Response& res) {
    try {
        nlohmann::json request_data = nlohmann::json::parse(req.body);
        
        if (!request_data.contains("username") || !request_data.contains("password")) {
            send_error(res, 400, "Username and password are required");
            return;
        }
        
        std::string username = request_data["username"];
        std::string password = request_data["password"];
        
        // Validate input
        if (!Auth::is_valid_username(username)) {
            send_error(res, 400, "Invalid username format");
            return;
        }
        
        if (!Auth::is_valid_password(password)) {
            send_error(res, 400, "Password does not meet requirements");
            return;
        }
        
        // Hash password and create user
        std::string password_hash = Auth::hash_password(password);
        database->create_user(username, password_hash);
        
        nlohmann::json response_data;
        response_data["message"] = "User registered successfully";
        response_data["username"] = username;
        
        send_success(res, response_data);
        
    } catch (const nlohmann::json::parse_error& e) {
        send_error(res, 400, "Invalid JSON in request body");
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

void HttpServer::handle_login(const httplib::Request& req, httplib::Response& res) {
    try {
        nlohmann::json request_data = nlohmann::json::parse(req.body);
        
        if (!request_data.contains("username") || !request_data.contains("password")) {
            send_error(res, 400, "Username and password are required");
            return;
        }
        
        std::string username = request_data["username"];
        std::string password = request_data["password"];
        
        // Don't hash password for authentication - use plain password
        // The database method will handle password verification
        if (database->authenticate_user(username, password)) {
            // Generate session token
            std::string session_token = Auth::generate_session_token(username);
            
            nlohmann::json response_data;
            response_data["message"] = "Login successful";
            response_data["username"] = username;
            response_data["session_token"] = session_token;
            
            send_success(res, response_data);
        } else {
            send_error(res, 401, "Invalid credentials");
        }
        
    } catch (const nlohmann::json::parse_error& e) {
        send_error(res, 400, "Invalid JSON in request body");
    } catch (const std::exception& e) {
        send_error(res, 500, "Internal server error");
    }
}

void HttpServer::handle_logout(const httplib::Request& req, httplib::Response& res) {
    // For MVP, logout is simple since we don't maintain server-side sessions
    nlohmann::json response_data;
    response_data["message"] = "Logout successful";
    
    send_success(res, response_data);
}

void HttpServer::handle_book_upload(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Check if file was uploaded
        auto file_it = req.files.find("file");
        if (file_it == req.files.end()) {
            send_error(res, 400, "No file uploaded");
            return;
        }
        
        const auto& file = file_it->second;
        if (file.content.empty()) {
            send_error(res, 400, "Empty file uploaded");
            return;
        }
        
        // Save book file and extract metadata
        BookInfo book_info = book_manager->save_uploaded_book(
            file.content, file.filename, file.content_type);
        
        // Override title and author if provided in form data
        if (req.has_param("title") && !req.get_param_value("title").empty()) {
            book_info.title = req.get_param_value("title");
        }
        if (req.has_param("author") && !req.get_param_value("author").empty()) {
            book_info.author = req.get_param_value("author");
        }
        
        // Add book to database with full metadata
        long book_id = database->add_book(book_info.title, book_info.author, 
                                         book_info.file_path, book_info.file_type,
                                         book_info.file_size, 
                                         book_info.metadata.description,
                                         book_info.metadata.publisher,
                                         book_info.metadata.isbn,
                                         book_info.metadata.language,
                                         book_info.thumbnail_path,
                                         book_info.metadata.page_count,
                                         book_info.metadata_extracted,
                                         book_info.extraction_error);
        
        nlohmann::json response_data;
        response_data["message"] = "Book uploaded successfully";
        response_data["book_id"] = book_id;
        response_data["title"] = book_info.title;
        response_data["author"] = book_info.author;
        response_data["file_type"] = book_info.file_type;
        response_data["file_size"] = book_info.file_size;
        
        send_success(res, response_data);
        
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

void HttpServer::handle_list_books(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Get user ID
        long user_id = database->get_user_id(username);
        if (user_id == -1) {
            send_error(res, 404, "User not found");
            return;
        }
        
        // Get books with progress
        nlohmann::json books = database->get_user_books_with_progress(user_id);
        
        send_success(res, books);
        
    } catch (const std::exception& e) {
        send_error(res, 500, "Failed to retrieve books");
    }
}

void HttpServer::handle_update_progress(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Parse book ID from URL
        long book_id = std::stol(req.matches[1]);
        
        // Parse progress data
        nlohmann::json progress_data = nlohmann::json::parse(req.body);
        
        // Get user ID
        long user_id = database->get_user_id(username);
        if (user_id == -1) {
            send_error(res, 404, "User not found");
            return;
        }
        
        // Update progress
        database->update_user_book_progress(user_id, book_id, progress_data);
        
        nlohmann::json response_data;
        response_data["message"] = "Progress updated successfully";
        response_data["book_id"] = book_id;
        response_data["progress"] = progress_data;
        
        send_success(res, response_data);
        
    } catch (const nlohmann::json::parse_error& e) {
        send_error(res, 400, "Invalid JSON in request body");
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

void HttpServer::handle_get_progress(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Parse book ID from URL
        long book_id = std::stol(req.matches[1]);
        
        // Get user ID
        long user_id = database->get_user_id(username);
        if (user_id == -1) {
            send_error(res, 404, "User not found");
            return;
        }
        
        // Get progress
        nlohmann::json progress = database->get_user_book_progress(user_id, book_id);
        
        nlohmann::json response_data;
        response_data["book_id"] = book_id;
        response_data["progress"] = progress;
        
        send_success(res, response_data);
        
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

void HttpServer::handle_book_download(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Parse book ID from URL
        long book_id = std::stol(req.matches[1]);
        
        // Get book information from database
        nlohmann::json all_books = database->get_all_books();
        nlohmann::json book_info;
        
        for (const auto& book : all_books) {
            if (book["id"] == book_id) {
                book_info = book;
                break;
            }
        }
        
        if (book_info.empty()) {
            send_error(res, 404, "Book not found");
            return;
        }
        
        std::string file_path = book_info["file_path"];
        
        // Check if file exists
        if (!fs::exists(file_path)) {
            send_error(res, 404, "Book file not found on disk");
            return;
        }
        
        // Read file content
        std::ifstream file(file_path, std::ios::binary);
        if (!file.is_open()) {
            send_error(res, 500, "Failed to open book file");
            return;
        }
        
        // Get file content
        std::string content((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
        file.close();
        
        // Set appropriate headers
        std::string filename = book_info["title"].get<std::string>() + "." + book_info["file_type"].get<std::string>();
        res.set_header("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        
        // Set content type based on file type
        std::string file_type = book_info["file_type"];
        if (file_type == "epub") {
            res.set_header("Content-Type", "application/epub+zip");
        } else if (file_type == "pdf") {
            res.set_header("Content-Type", "application/pdf");
        } else if (file_type == "cbz") {
            res.set_header("Content-Type", "application/zip");
        } else if (file_type == "cbr") {
            res.set_header("Content-Type", "application/x-rar-compressed");
        } else {
            res.set_header("Content-Type", "application/octet-stream");
        }
        
        res.set_content(content, res.get_header_value("Content-Type"));
        
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

void HttpServer::handle_book_file_access(const httplib::Request& req, httplib::Response& res) {
    try {
        // Validate session
        std::string username = validate_session(req);
        if (username.empty()) {
            send_error(res, 401, "Authentication required");
            return;
        }
        
        // Parse book ID from URL
        long book_id = std::stol(req.matches[1]);
        
        // Get book information from database
        nlohmann::json all_books = database->get_all_books();
        nlohmann::json book_info;
        
        for (const auto& book : all_books) {
            if (book["id"] == book_id) {
                book_info = book;
                break;
            }
        }
        
        if (book_info.empty()) {
            send_error(res, 404, "Book not found");
            return;
        }
        
        std::string file_path = book_info["file_path"];
        
        // Check if file exists
        if (!fs::exists(file_path)) {
            send_error(res, 404, "Book file not found on disk");
            return;
        }
        
        // Read file content
        std::ifstream file(file_path, std::ios::binary);
        if (!file.is_open()) {
            send_error(res, 500, "Failed to open book file");
            return;
        }
        
        // Get file content
        std::string content((std::istreambuf_iterator<char>(file)),
                           std::istreambuf_iterator<char>());
        file.close();
        
        // Set appropriate headers for inline viewing
        std::string file_type = book_info["file_type"];
        if (file_type == "epub") {
            res.set_header("Content-Type", "application/epub+zip");
        } else if (file_type == "pdf") {
            res.set_header("Content-Type", "application/pdf");
        } else if (file_type == "cbz") {
            res.set_header("Content-Type", "application/zip");
        } else if (file_type == "cbr") {
            res.set_header("Content-Type", "application/x-rar-compressed");
        } else {
            res.set_header("Content-Type", "application/octet-stream");
        }
        
        // For inline viewing (not download)
        res.set_header("Content-Disposition", "inline");
        res.set_content(content, res.get_header_value("Content-Type"));
        
    } catch (const std::exception& e) {
        send_error(res, 400, e.what());
    }
}

bool HttpServer::start() {
    try {
        std::cout << "Starting HTTP server on port " << port << "..." << std::endl;
        std::cout << "API endpoints available at: http://localhost:" << port << "/api/" << std::endl;
        std::cout << "Web interface available at: http://localhost:" << port << "/" << std::endl;
        
        return server.listen("0.0.0.0", port);
    } catch (const std::exception& e) {
        std::cerr << "Failed to start server: " << e.what() << std::endl;
        return false;
    }
}

void HttpServer::handle_book_thumbnail(const httplib::Request& req, httplib::Response& res) {
    try {
        // Parse book ID from URL
        long book_id = std::stol(req.matches[1]);
        
        // Get book information from database
        nlohmann::json all_books = database->get_all_books();
        nlohmann::json book_info;
        
        for (const auto& book : all_books) {
            if (book["id"] == book_id) {
                book_info = book;
                break;
            }
        }
        
        if (book_info.empty()) {
            send_error(res, 404, "Book not found");
            return;
        }
        
        // Get thumbnail path from database
        std::string thumbnail_path;
        if (book_info.contains("thumbnail_path") && !book_info["thumbnail_path"].is_null()) {
            thumbnail_path = book_info["thumbnail_path"];
        }
        
        if (thumbnail_path.empty() || !fs::exists(thumbnail_path)) {
            send_error(res, 404, "Thumbnail not found");
            return;
        }
        
        // Read thumbnail file
        std::ifstream file(thumbnail_path, std::ios::binary);
        if (!file.is_open()) {
            send_error(res, 500, "Failed to read thumbnail file");
            return;
        }
        
        std::string content((std::istreambuf_iterator<char>(file)),
                          std::istreambuf_iterator<char>());
        file.close();
        
        // Determine content type based on file extension
        std::string content_type = "application/octet-stream";
        if (thumbnail_path.ends_with(".svg")) {
            content_type = "image/svg+xml";
        } else if (thumbnail_path.ends_with(".jpg") || thumbnail_path.ends_with(".jpeg")) {
            content_type = "image/jpeg";
        } else if (thumbnail_path.ends_with(".png")) {
            content_type = "image/png";
        }
        
        res.set_content(content, content_type);
        
    } catch (const std::exception& e) {
        send_error(res, 500, "Failed to get thumbnail: " + std::string(e.what()));
    }
}

void HttpServer::stop() {
    server.stop();
    std::cout << "HTTP server stopped." << std::endl;
}
