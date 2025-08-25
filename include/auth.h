/**
 * @file auth.h
 * @brief Authentication and authorization utilities for MyLibrary server
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#ifndef AUTH_H
#define AUTH_H

#include <string>

/**
 * @class Auth
 * @brief Provides authentication and password hashing utilities
 * 
 * This class handles secure password hashing using BCrypt and
 * provides utilities for user authentication.
 */
class Auth {
public:
    /**
     * @brief Generates a BCrypt hash for the given password
     * @param password Plain text password to hash
     * @return BCrypt hashed password string
     * @throws std::runtime_error if hashing fails
     */
    static std::string hash_password(const std::string& password);

    /**
     * @brief Verifies a password against its BCrypt hash
     * @param password Plain text password to verify
     * @param hash BCrypt hash to compare against
     * @return true if password matches the hash, false otherwise
     */
    static bool verify_password(const std::string& password, const std::string& hash);

    /**
     * @brief Validates username format and requirements
     * @param username Username to validate
     * @return true if username is valid, false otherwise
     * 
     * Valid username requirements:
     * - Length: 3-50 characters
     * - Allowed characters: alphanumeric, underscore, hyphen
     * - Must start with alphanumeric character
     */
    static bool is_valid_username(const std::string& username);

    /**
     * @brief Validates password strength requirements
     * @param password Password to validate
     * @return true if password meets requirements, false otherwise
     * 
     * Password requirements:
     * - Minimum length: 8 characters
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one digit
     */
    static bool is_valid_password(const std::string& password);

    /**
     * @brief Generates a simple session token (for demo purposes)
     * @param username Username for the session
     * @return Session token string
     * @note This is a simple implementation for MVP. In production,
     *       use proper JWT or similar secure token mechanisms.
     */
    static std::string generate_session_token(const std::string& username);

    /**
     * @brief Validates a session token (for demo purposes)
     * @param token Session token to validate
     * @return Username if token is valid, empty string otherwise
     * @note This is a simple implementation for MVP.
     */
    static std::string validate_session_token(const std::string& token);
};

#endif // AUTH_H
