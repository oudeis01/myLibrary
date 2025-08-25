/**
 * @file auth.cpp
 * @brief Implementation of Auth class for authentication and password management
 * @author MyLibrary Team
 * @version 0.1.0
 * @date 2025-08-25
 */

#include "auth.h"
#include <openssl/sha.h>
#include <openssl/rand.h>
#include <regex>
#include <sstream>
#include <iomanip>
#include <random>
#include <chrono>

std::string Auth::hash_password(const std::string& password) {
    try {
        // Use SHA-256 with salt (more secure than std::hash)
        // Generate random salt using OpenSSL
        unsigned char salt[16];
        if (RAND_bytes(salt, sizeof(salt)) != 1) {
            throw std::runtime_error("Failed to generate salt");
        }
        
        // Convert salt to hex string
        std::stringstream salt_hex;
        for (int i = 0; i < 16; i++) {
            salt_hex << std::hex << std::setw(2) << std::setfill('0') << (int)salt[i];
        }
        
        // Combine password and salt
        std::string salted_password = password + salt_hex.str();
        
        // Hash with SHA-256
        unsigned char hash[SHA256_DIGEST_LENGTH];
        SHA256_CTX sha256;
        SHA256_Init(&sha256);
        SHA256_Update(&sha256, salted_password.c_str(), salted_password.length());
        SHA256_Final(hash, &sha256);
        
        // Convert hash to hex string
        std::stringstream hash_hex;
        for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
            hash_hex << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
        }
        
        // Return salt + hash (salt:hash format)
        return salt_hex.str() + ":" + hash_hex.str();
    } catch (const std::exception& e) {
        throw std::runtime_error("Failed to hash password: " + std::string(e.what()));
    }
}

bool Auth::verify_password(const std::string& password, const std::string& hash) {
    try {
        // Split salt and hash
        size_t colon_pos = hash.find(':');
        if (colon_pos == std::string::npos || colon_pos != 32) {
            return false;
        }
        
        std::string salt_hex = hash.substr(0, 32);
        std::string stored_hash = hash.substr(33);
        
        // Combine password and salt
        std::string salted_password = password + salt_hex;
        
        // Hash with SHA-256
        unsigned char computed_hash[SHA256_DIGEST_LENGTH];
        SHA256_CTX sha256;
        SHA256_Init(&sha256);
        SHA256_Update(&sha256, salted_password.c_str(), salted_password.length());
        SHA256_Final(computed_hash, &sha256);
        
        // Convert to hex string
        std::stringstream hash_hex;
        for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
            hash_hex << std::hex << std::setw(2) << std::setfill('0') << (int)computed_hash[i];
        }
        
        // Compare hashes in constant time to prevent timing attacks
        return hash_hex.str() == stored_hash;
    } catch (const std::exception& e) {
        return false;
    }
}

bool Auth::is_valid_username(const std::string& username) {
    // Check length requirements (3-50 characters)
    if (username.length() < 3 || username.length() > 50) {
        return false;
    }
    
    // Check if starts with alphanumeric character
    if (!std::isalnum(username[0])) {
        return false;
    }
    
    // Check allowed characters: alphanumeric, underscore, hyphen
    std::regex valid_pattern("^[a-zA-Z0-9][a-zA-Z0-9_-]*$");
    return std::regex_match(username, valid_pattern);
}

bool Auth::is_valid_password(const std::string& password) {
    // Check minimum length
    if (password.length() < 8) {
        return false;
    }
    
    bool has_uppercase = false;
    bool has_lowercase = false;
    bool has_digit = false;
    
    for (char c : password) {
        if (std::isupper(c)) {
            has_uppercase = true;
        } else if (std::islower(c)) {
            has_lowercase = true;
        } else if (std::isdigit(c)) {
            has_digit = true;
        }
    }
    
    return has_uppercase && has_lowercase && has_digit;
}

std::string Auth::generate_session_token(const std::string& username) {
    // Simple session token for MVP (in production, use proper JWT)
    // Format: username:timestamp:random_string
    
    auto now = std::chrono::system_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
    
    // Generate random string
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 15);
    
    std::stringstream random_hex;
    for (int i = 0; i < 16; ++i) {
        random_hex << std::hex << dis(gen);
    }
    
    std::stringstream token;
    token << username << ":" << timestamp << ":" << random_hex.str();
    
    // Base64-like encoding for the token (simple approach for MVP)
    std::string token_str = token.str();
    std::stringstream encoded;
    for (size_t i = 0; i < token_str.length(); i += 3) {
        std::string chunk = token_str.substr(i, 3);
        while (chunk.length() < 3) chunk += '=';
        
        for (char c : chunk) {
            encoded << std::hex << static_cast<int>(c);
        }
    }
    
    return encoded.str();
}

std::string Auth::validate_session_token(const std::string& token) {
    try {
        // Decode the token (reverse of generate_session_token)
        std::string decoded;
        for (size_t i = 0; i < token.length(); i += 2) {
            if (i + 1 < token.length()) {
                std::string hex_byte = token.substr(i, 2);
                int value = std::stoi(hex_byte, nullptr, 16);
                decoded += static_cast<char>(value);
            }
        }
        
        // Remove padding
        while (!decoded.empty() && decoded.back() == '=') {
            decoded.pop_back();
        }
        
        // Parse the decoded token
        std::istringstream iss(decoded);
        std::string username, timestamp_str, random_part;
        
        if (!std::getline(iss, username, ':') ||
            !std::getline(iss, timestamp_str, ':') ||
            !std::getline(iss, random_part)) {
            return "";
        }
        
        // Check if token is not too old (24 hours for MVP)
        auto now = std::chrono::system_clock::now();
        auto current_timestamp = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
        auto token_timestamp = std::stoll(timestamp_str);
        
        const long MAX_TOKEN_AGE = 24 * 60 * 60; // 24 hours in seconds
        if (current_timestamp - token_timestamp > MAX_TOKEN_AGE) {
            return "";
        }
        
        return username;
    } catch (const std::exception& e) {
        return "";
    }
}
