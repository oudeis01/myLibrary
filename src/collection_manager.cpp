/**
 * @file collection_manager.cpp
 * @brief Implementation of the CollectionManager class
 * 
 * This file contains the complete implementation of collection management
 * functionality, providing Spotify-like playlist features for book collections.
 * 
 * @author GitHub Copilot
 * @date 2025-08-25
 * @version 1.0
 */

#include "collection_manager.h"
#include <iostream>
#include <sstream>
#include <algorithm>
#include <iomanip>

// ========== Constructor and Destructor ==========

/**
 * @brief Constructor - Initialize collection manager with database connection
 * @param connection Shared pointer to PostgreSQL connection
 */
CollectionManager::CollectionManager(std::shared_ptr<pqxx::connection> connection)
    : db_connection(connection) {
    // Verify connection is valid
    if (!db_connection || !db_connection->is_open()) {
        throw std::runtime_error("Invalid database connection provided to CollectionManager");
    }
}

// ========== Collection CRUD Operations ==========

/**
 * @brief Create a new collection for a user
 * @param owner_id User ID who will own the collection
 * @param name Collection name (must be unique per user)
 * @param description Optional description
 * @param is_public Whether collection should be publicly visible
 * @return Collection ID on success, -1 on failure
 */
int CollectionManager::createCollection(int owner_id, const std::string& name, 
                                       const std::string& description, bool is_public) {
    try {
        pqxx::work txn(*db_connection);
        
        // Check if user already has a collection with this name
        std::string check_query = R"(
            SELECT COUNT(*) FROM collections 
            WHERE owner_id = $1 AND name = $2
        )";
        
        pqxx::result check_result = txn.exec_params(check_query, owner_id, name);
        if (check_result[0][0].as<int>() > 0) {
            std::cerr << "Collection with name '" << name << "' already exists for user " << owner_id << std::endl;
            return -1;
        }
        
        // Insert new collection
        std::string insert_query = R"(
            INSERT INTO collections (name, description, owner_id, is_public, created_at, updated_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
        )";
        
        pqxx::result result = txn.exec_params(insert_query, name, description, owner_id, is_public);
        
        if (result.empty()) {
            std::cerr << "Failed to create collection" << std::endl;
            return -1;
        }
        
        int collection_id = result[0][0].as<int>();
        txn.commit();
        
        std::cout << "Created collection '" << name << "' with ID " << collection_id 
                  << " for user " << owner_id << std::endl;
        return collection_id;
        
    } catch (const std::exception& e) {
        std::cerr << "Error creating collection: " << e.what() << std::endl;
        return -1;
    }
}

/**
 * @brief Get collection details by ID
 * @param collection_id Collection identifier
 * @param requesting_user_id User requesting the information
 * @return Collection object if accessible, nullopt otherwise
 */
std::optional<Collection> CollectionManager::getCollection(int collection_id, int requesting_user_id) {
    try {
        pqxx::work txn(*db_connection);
        
        // Get collection with owner username and book count
        std::string query = R"(
            SELECT c.id, c.name, c.description, c.owner_id, u.username, 
                   c.is_public, c.created_at, c.updated_at,
                   COALESCE(book_count.count, 0) as book_count
            FROM collections c
            JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT collection_id, COUNT(*) as count 
                FROM collection_books 
                GROUP BY collection_id
            ) book_count ON c.id = book_count.collection_id
            WHERE c.id = $1
        )";
        
        pqxx::result result = txn.exec_params(query, collection_id);
        
        if (result.empty()) {
            return std::nullopt;
        }
        
        auto row = result[0];
        bool is_public = row["is_public"].as<bool>();
        int owner_id = row["owner_id"].as<int>();
        
        // Check if user has access
        if (!is_public && owner_id != requesting_user_id) {
            // Check if user has explicit permission
            auto permission = getUserPermission(collection_id, requesting_user_id);
            if (!permission.has_value()) {
                return std::nullopt; // No access
            }
        }
        
        // Get book IDs in this collection
        std::string books_query = R"(
            SELECT book_id FROM collection_books 
            WHERE collection_id = $1 
            ORDER BY added_at DESC
        )";
        
        pqxx::result books_result = txn.exec_params(books_query, collection_id);
        std::vector<int> book_ids;
        for (const auto& book_row : books_result) {
            book_ids.push_back(book_row["book_id"].as<int>());
        }
        
        Collection collection{
            .id = row["id"].as<int>(),
            .name = row["name"].as<std::string>(),
            .description = row["description"].is_null() ? "" : row["description"].as<std::string>(),
            .owner_id = owner_id,
            .owner_username = row["username"].as<std::string>(),
            .is_public = is_public,
            .created_at = row["created_at"].as<std::string>(),
            .updated_at = row["updated_at"].as<std::string>(),
            .book_ids = book_ids,
            .book_count = row["book_count"].as<int>()
        };
        
        return collection;
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting collection: " << e.what() << std::endl;
        return std::nullopt;
    }
}

/**
 * @brief Update collection metadata
 * @param collection_id Collection to update
 * @param user_id User performing the update
 * @param name New name (if not empty)
 * @param description New description (if not empty)
 * @param is_public New visibility setting (if has value)
 * @return true on success, false on failure
 */
bool CollectionManager::updateCollection(int collection_id, int user_id, 
                                        const std::string& name, 
                                        const std::string& description, 
                                        std::optional<bool> is_public) {
    try {
        // Check if user has EDIT permission
        if (!hasPermission(collection_id, user_id, CollectionPermission::EDIT)) {
            std::cerr << "User " << user_id << " does not have EDIT permission for collection " 
                      << collection_id << std::endl;
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        // Build dynamic update query
        std::vector<std::string> updates;
        std::vector<std::string> params;
        int param_count = 1;
        
        if (!name.empty()) {
            // Check for name uniqueness within user's collections
            std::string check_query = R"(
                SELECT COUNT(*) FROM collections 
                WHERE owner_id = (SELECT owner_id FROM collections WHERE id = $1) 
                AND name = $2 AND id != $1
            )";
            
            pqxx::result check_result = txn.exec_params(check_query, collection_id, name);
            if (check_result[0][0].as<int>() > 0) {
                std::cerr << "Collection name '" << name << "' already exists for this user" << std::endl;
                return false;
            }
            
            updates.push_back("name = $" + std::to_string(++param_count));
            params.push_back(name);
        }
        
        if (!description.empty()) {
            updates.push_back("description = $" + std::to_string(++param_count));
            params.push_back(description);
        }
        
        if (is_public.has_value()) {
            updates.push_back("is_public = $" + std::to_string(++param_count));
            params.push_back(is_public.value() ? "true" : "false");
        }
        
        if (updates.empty()) {
            return true; // Nothing to update
        }
        
        updates.push_back("updated_at = CURRENT_TIMESTAMP");
        
        std::string update_query = "UPDATE collections SET " + 
                                 std::accumulate(updates.begin(), updates.end(), std::string{},
                                               [](const std::string& a, const std::string& b) {
                                                   return a.empty() ? b : a + ", " + b;
                                               }) +
                                 " WHERE id = $1";
        
        // Execute update with parameters
        if (params.empty()) {
            txn.exec_params(update_query, collection_id);
        } else if (params.size() == 1) {
            txn.exec_params(update_query, collection_id, params[0]);
        } else if (params.size() == 2) {
            txn.exec_params(update_query, collection_id, params[0], params[1]);
        } else if (params.size() == 3) {
            txn.exec_params(update_query, collection_id, params[0], params[1], params[2]);
        }
        
        txn.commit();
        std::cout << "Updated collection " << collection_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error updating collection: " << e.what() << std::endl;
        return false;
    }
}

/**
 * @brief Delete a collection permanently
 * @param collection_id Collection to delete
 * @param user_id User requesting deletion
 * @return true on success, false on failure
 */
bool CollectionManager::deleteCollection(int collection_id, int user_id) {
    try {
        // Check if user has ADMIN permission or is owner
        if (!hasPermission(collection_id, user_id, CollectionPermission::ADMIN) &&
            getCollectionOwner(collection_id) != user_id) {
            std::cerr << "User " << user_id << " does not have permission to delete collection " 
                      << collection_id << std::endl;
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        // Delete collection (CASCADE will handle related records)
        std::string delete_query = "DELETE FROM collections WHERE id = $1";
        pqxx::result result = txn.exec_params(delete_query, collection_id);
        
        if (result.affected_rows() == 0) {
            std::cerr << "Collection " << collection_id << " not found" << std::endl;
            return false;
        }
        
        txn.commit();
        std::cout << "Deleted collection " << collection_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error deleting collection: " << e.what() << std::endl;
        return false;
    }
}

// ========== Collection Discovery ==========

/**
 * @brief Get all collections owned by a specific user
 * @param user_id Owner's user ID
 * @return Vector of collections owned by the user
 */
std::vector<Collection> CollectionManager::getUserCollections(int user_id) {
    std::vector<Collection> collections;
    
    try {
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT c.id, c.name, c.description, c.owner_id, u.username, 
                   c.is_public, c.created_at, c.updated_at,
                   COALESCE(book_count.count, 0) as book_count
            FROM collections c
            JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT collection_id, COUNT(*) as count 
                FROM collection_books 
                GROUP BY collection_id
            ) book_count ON c.id = book_count.collection_id
            WHERE c.owner_id = $1
            ORDER BY c.updated_at DESC
        )";
        
        pqxx::result result = txn.exec_params(query, user_id);
        
        for (const auto& row : result) {
            // Get book IDs for each collection
            std::string books_query = R"(
                SELECT book_id FROM collection_books 
                WHERE collection_id = $1 
                ORDER BY added_at DESC
            )";
            
            pqxx::result books_result = txn.exec_params(books_query, row["id"].as<int>());
            std::vector<int> book_ids;
            for (const auto& book_row : books_result) {
                book_ids.push_back(book_row["book_id"].as<int>());
            }
            
            Collection collection{
                .id = row["id"].as<int>(),
                .name = row["name"].as<std::string>(),
                .description = row["description"].is_null() ? "" : row["description"].as<std::string>(),
                .owner_id = row["owner_id"].as<int>(),
                .owner_username = row["username"].as<std::string>(),
                .is_public = row["is_public"].as<bool>(),
                .created_at = row["created_at"].as<std::string>(),
                .updated_at = row["updated_at"].as<std::string>(),
                .book_ids = book_ids,
                .book_count = row["book_count"].as<int>()
            };
            
            collections.push_back(collection);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting user collections: " << e.what() << std::endl;
    }
    
    return collections;
}

/**
 * @brief Get all collections accessible to a user
 * @param user_id User ID
 * @return Vector of accessible collections
 */
std::vector<Collection> CollectionManager::getAccessibleCollections(int user_id) {
    std::vector<Collection> collections;
    
    try {
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT DISTINCT c.id, c.name, c.description, c.owner_id, u.username, 
                   c.is_public, c.created_at, c.updated_at,
                   COALESCE(book_count.count, 0) as book_count
            FROM collections c
            JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT collection_id, COUNT(*) as count 
                FROM collection_books 
                GROUP BY collection_id
            ) book_count ON c.id = book_count.collection_id
            LEFT JOIN collection_permissions cp ON c.id = cp.collection_id AND cp.user_id = $1
            WHERE c.owner_id = $1 
               OR c.is_public = true 
               OR cp.user_id = $1
            ORDER BY 
                CASE WHEN c.owner_id = $1 THEN 0 ELSE 1 END,
                c.updated_at DESC
        )";
        
        pqxx::result result = txn.exec_params(query, user_id);
        
        for (const auto& row : result) {
            // Get book IDs for each collection
            std::string books_query = R"(
                SELECT book_id FROM collection_books 
                WHERE collection_id = $1 
                ORDER BY added_at DESC
                LIMIT 10
            )";
            
            pqxx::result books_result = txn.exec_params(books_query, row["id"].as<int>());
            std::vector<int> book_ids;
            for (const auto& book_row : books_result) {
                book_ids.push_back(book_row["book_id"].as<int>());
            }
            
            Collection collection{
                .id = row["id"].as<int>(),
                .name = row["name"].as<std::string>(),
                .description = row["description"].is_null() ? "" : row["description"].as<std::string>(),
                .owner_id = row["owner_id"].as<int>(),
                .owner_username = row["username"].as<std::string>(),
                .is_public = row["is_public"].as<bool>(),
                .created_at = row["created_at"].as<std::string>(),
                .updated_at = row["updated_at"].as<std::string>(),
                .book_ids = book_ids,
                .book_count = row["book_count"].as<int>()
            };
            
            collections.push_back(collection);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting accessible collections: " << e.what() << std::endl;
    }
    
    return collections;
}

/**
 * @brief Get public collections for discovery
 * @param limit Maximum number of collections to return
 * @param offset Number of collections to skip (for pagination)
 * @return Vector of public collections
 */
std::vector<Collection> CollectionManager::getPublicCollections(int limit, int offset) {
    std::vector<Collection> collections;
    
    try {
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT c.id, c.name, c.description, c.owner_id, u.username, 
                   c.is_public, c.created_at, c.updated_at,
                   COALESCE(book_count.count, 0) as book_count
            FROM collections c
            JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT collection_id, COUNT(*) as count 
                FROM collection_books 
                GROUP BY collection_id
            ) book_count ON c.id = book_count.collection_id
            WHERE c.is_public = true
            ORDER BY c.created_at DESC
            LIMIT $1 OFFSET $2
        )";
        
        pqxx::result result = txn.exec_params(query, limit, offset);
        
        for (const auto& row : result) {
            // Get first few book IDs for preview
            std::string books_query = R"(
                SELECT book_id FROM collection_books 
                WHERE collection_id = $1 
                ORDER BY added_at DESC
                LIMIT 5
            )";
            
            pqxx::result books_result = txn.exec_params(books_query, row["id"].as<int>());
            std::vector<int> book_ids;
            for (const auto& book_row : books_result) {
                book_ids.push_back(book_row["book_id"].as<int>());
            }
            
            Collection collection{
                .id = row["id"].as<int>(),
                .name = row["name"].as<std::string>(),
                .description = row["description"].is_null() ? "" : row["description"].as<std::string>(),
                .owner_id = row["owner_id"].as<int>(),
                .owner_username = row["username"].as<std::string>(),
                .is_public = row["is_public"].as<bool>(),
                .created_at = row["created_at"].as<std::string>(),
                .updated_at = row["updated_at"].as<std::string>(),
                .book_ids = book_ids,
                .book_count = row["book_count"].as<int>()
            };
            
            collections.push_back(collection);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting public collections: " << e.what() << std::endl;
    }
    
    return collections;
}

/**
 * @brief Search collections by name
 * @param query Search term
 * @param user_id User performing the search
 * @param search_public_only Whether to search only public collections
 * @return Vector of matching collections
 */
std::vector<Collection> CollectionManager::searchCollections(const std::string& query, int user_id, 
                                                           bool search_public_only) {
    std::vector<Collection> collections;
    
    try {
        pqxx::work txn(*db_connection);
        
        std::string sql_query;
        if (search_public_only) {
            sql_query = R"(
                SELECT c.id, c.name, c.description, c.owner_id, u.username, 
                       c.is_public, c.created_at, c.updated_at,
                       COALESCE(book_count.count, 0) as book_count
                FROM collections c
                JOIN users u ON c.owner_id = u.id
                LEFT JOIN (
                    SELECT collection_id, COUNT(*) as count 
                    FROM collection_books 
                    GROUP BY collection_id
                ) book_count ON c.id = book_count.collection_id
                WHERE c.is_public = true 
                  AND (LOWER(c.name) LIKE LOWER($1) OR LOWER(c.description) LIKE LOWER($1))
                ORDER BY c.updated_at DESC
                LIMIT 50
            )";
        } else {
            sql_query = R"(
                SELECT DISTINCT c.id, c.name, c.description, c.owner_id, u.username, 
                       c.is_public, c.created_at, c.updated_at,
                       COALESCE(book_count.count, 0) as book_count
                FROM collections c
                JOIN users u ON c.owner_id = u.id
                LEFT JOIN (
                    SELECT collection_id, COUNT(*) as count 
                    FROM collection_books 
                    GROUP BY collection_id
                ) book_count ON c.id = book_count.collection_id
                LEFT JOIN collection_permissions cp ON c.id = cp.collection_id AND cp.user_id = $2
                WHERE (c.owner_id = $2 OR c.is_public = true OR cp.user_id = $2)
                  AND (LOWER(c.name) LIKE LOWER($1) OR LOWER(c.description) LIKE LOWER($1))
                ORDER BY 
                    CASE WHEN c.owner_id = $2 THEN 0 ELSE 1 END,
                    c.updated_at DESC
                LIMIT 50
            )";
        }
        
        std::string search_pattern = "%" + query + "%";
        pqxx::result result;
        
        if (search_public_only) {
            result = txn.exec_params(sql_query, search_pattern);
        } else {
            result = txn.exec_params(sql_query, search_pattern, user_id);
        }
        
        for (const auto& row : result) {
            // Get first few book IDs for preview
            std::string books_query = R"(
                SELECT book_id FROM collection_books 
                WHERE collection_id = $1 
                ORDER BY added_at DESC
                LIMIT 5
            )";
            
            pqxx::result books_result = txn.exec_params(books_query, row["id"].as<int>());
            std::vector<int> book_ids;
            for (const auto& book_row : books_result) {
                book_ids.push_back(book_row["book_id"].as<int>());
            }
            
            Collection collection{
                .id = row["id"].as<int>(),
                .name = row["name"].as<std::string>(),
                .description = row["description"].is_null() ? "" : row["description"].as<std::string>(),
                .owner_id = row["owner_id"].as<int>(),
                .owner_username = row["username"].as<std::string>(),
                .is_public = row["is_public"].as<bool>(),
                .created_at = row["created_at"].as<std::string>(),
                .updated_at = row["updated_at"].as<std::string>(),
                .book_ids = book_ids,
                .book_count = row["book_count"].as<int>()
            };
            
            collections.push_back(collection);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error searching collections: " << e.what() << std::endl;
    }
    
    return collections;
}

// ========== Book Management in Collections ==========

/**
 * @brief Add a book to a collection
 * @param collection_id Target collection
 * @param book_id Book to add
 * @param user_id User performing the action
 * @return true on success, false on failure
 */
bool CollectionManager::addBookToCollection(int collection_id, int book_id, int user_id) {
    try {
        // Check if user has ADD_BOOKS permission
        if (!hasPermission(collection_id, user_id, CollectionPermission::ADD_BOOKS)) {
            std::cerr << "User " << user_id << " does not have ADD_BOOKS permission for collection " 
                      << collection_id << std::endl;
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        // Check if book exists
        std::string book_check_query = "SELECT COUNT(*) FROM books WHERE id = $1";
        pqxx::result book_check = txn.exec_params(book_check_query, book_id);
        if (book_check[0][0].as<int>() == 0) {
            std::cerr << "Book " << book_id << " does not exist" << std::endl;
            return false;
        }
        
        // Check if book is already in collection
        std::string exists_query = R"(
            SELECT COUNT(*) FROM collection_books 
            WHERE collection_id = $1 AND book_id = $2
        )";
        pqxx::result exists_result = txn.exec_params(exists_query, collection_id, book_id);
        if (exists_result[0][0].as<int>() > 0) {
            std::cerr << "Book " << book_id << " is already in collection " << collection_id << std::endl;
            return false;
        }
        
        // Add book to collection
        std::string insert_query = R"(
            INSERT INTO collection_books (collection_id, book_id, added_at, added_by)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
        )";
        txn.exec_params(insert_query, collection_id, book_id, user_id);
        
        // Update collection timestamp
        updateCollectionTimestamp(collection_id);
        
        txn.commit();
        std::cout << "Added book " << book_id << " to collection " << collection_id 
                  << " by user " << user_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error adding book to collection: " << e.what() << std::endl;
        return false;
    }
}

/**
 * @brief Remove a book from a collection
 * @param collection_id Source collection
 * @param book_id Book to remove
 * @param user_id User performing the action
 * @return true on success, false on failure
 */
bool CollectionManager::removeBookFromCollection(int collection_id, int book_id, int user_id) {
    try {
        pqxx::work txn(*db_connection);
        
        // Check if user has permission (ADD_BOOKS or higher, or user who added the book)
        bool has_permission = hasPermission(collection_id, user_id, CollectionPermission::ADD_BOOKS);
        
        if (!has_permission) {
            // Check if user is the one who added this book
            std::string added_by_query = R"(
                SELECT added_by FROM collection_books 
                WHERE collection_id = $1 AND book_id = $2
            )";
            pqxx::result added_by_result = txn.exec_params(added_by_query, collection_id, book_id);
            
            if (added_by_result.empty()) {
                std::cerr << "Book " << book_id << " is not in collection " << collection_id << std::endl;
                return false;
            }
            
            int added_by = added_by_result[0][0].is_null() ? -1 : added_by_result[0][0].as<int>();
            if (added_by != user_id) {
                std::cerr << "User " << user_id << " does not have permission to remove book " 
                          << book_id << " from collection " << collection_id << std::endl;
                return false;
            }
        }
        
        // Remove book from collection
        std::string delete_query = R"(
            DELETE FROM collection_books 
            WHERE collection_id = $1 AND book_id = $2
        )";
        pqxx::result result = txn.exec_params(delete_query, collection_id, book_id);
        
        if (result.affected_rows() == 0) {
            std::cerr << "Book " << book_id << " was not in collection " << collection_id << std::endl;
            return false;
        }
        
        // Update collection timestamp
        updateCollectionTimestamp(collection_id);
        
        txn.commit();
        std::cout << "Removed book " << book_id << " from collection " << collection_id 
                  << " by user " << user_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error removing book from collection: " << e.what() << std::endl;
        return false;
    }
}

/**
 * @brief Get all books in a collection
 * @param collection_id Collection identifier
 * @param user_id User requesting the books
 * @return Vector of books in the collection
 */
std::vector<CollectionBook> CollectionManager::getCollectionBooks(int collection_id, int user_id) {
    std::vector<CollectionBook> books;
    
    try {
        // Check if user has VIEW permission
        if (!hasPermission(collection_id, user_id, CollectionPermission::VIEW)) {
            std::cerr << "User " << user_id << " does not have VIEW permission for collection " 
                      << collection_id << std::endl;
            return books;
        }
        
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT b.id, b.title, b.author, b.file_type,
                   cb.added_at, cb.added_by, u.username as added_by_username
            FROM collection_books cb
            JOIN books b ON cb.book_id = b.id
            LEFT JOIN users u ON cb.added_by = u.id
            WHERE cb.collection_id = $1
            ORDER BY cb.added_at DESC
        )";
        
        pqxx::result result = txn.exec_params(query, collection_id);
        
        for (const auto& row : result) {
            CollectionBook book{
                .book_id = row["id"].as<int>(),
                .title = row["title"].as<std::string>(),
                .author = row["author"].is_null() ? "" : row["author"].as<std::string>(),
                .file_type = row["file_type"].as<std::string>(),
                .added_at = row["added_at"].as<std::string>(),
                .added_by_username = row["added_by_username"].is_null() ? "Unknown" : row["added_by_username"].as<std::string>(),
                .added_by_id = row["added_by"].is_null() ? -1 : row["added_by"].as<int>()
            };
            
            books.push_back(book);
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting collection books: " << e.what() << std::endl;
    }
    
    return books;
}

/**
 * @brief Check if a book is in a collection
 * @param collection_id Collection to check
 * @param book_id Book to look for
 * @param user_id User making the request
 * @return true if book is in collection and user can see it
 */
bool CollectionManager::isBookInCollection(int collection_id, int book_id, int user_id) {
    try {
        // Check if user has VIEW permission
        if (!hasPermission(collection_id, user_id, CollectionPermission::VIEW)) {
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT COUNT(*) FROM collection_books 
            WHERE collection_id = $1 AND book_id = $2
        )";
        pqxx::result result = txn.exec_params(query, collection_id, book_id);
        
        return result[0][0].as<int>() > 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Error checking book in collection: " << e.what() << std::endl;
        return false;
    }
}

// ========== Permission Management ==========

/**
 * @brief Grant permission to a user for a collection
 * @param collection_id Target collection
 * @param user_id User to grant permission to
 * @param permission Permission level to grant
 * @param granting_user_id User granting the permission
 * @return true on success, false on failure
 */
bool CollectionManager::grantPermission(int collection_id, int user_id, 
                                       CollectionPermission permission, int granting_user_id) {
    try {
        // Check if granting user has ADMIN permission or is owner
        if (!hasPermission(collection_id, granting_user_id, CollectionPermission::ADMIN) &&
            getCollectionOwner(collection_id) != granting_user_id) {
            std::cerr << "User " << granting_user_id << " does not have permission to grant access to collection " 
                      << collection_id << std::endl;
            return false;
        }
        
        // Cannot grant permission to owner (they already have all permissions)
        if (getCollectionOwner(collection_id) == user_id) {
            std::cerr << "Cannot grant explicit permission to collection owner" << std::endl;
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        // Check if user exists
        std::string user_check_query = "SELECT COUNT(*) FROM users WHERE id = $1";
        pqxx::result user_check = txn.exec_params(user_check_query, user_id);
        if (user_check[0][0].as<int>() == 0) {
            std::cerr << "User " << user_id << " does not exist" << std::endl;
            return false;
        }
        
        std::string permission_str = permissionToString(permission);
        
        // Insert or update permission
        std::string upsert_query = R"(
            INSERT INTO collection_permissions (collection_id, user_id, permission_type, granted_by, granted_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (collection_id, user_id) 
            DO UPDATE SET 
                permission_type = EXCLUDED.permission_type,
                granted_by = EXCLUDED.granted_by,
                granted_at = CURRENT_TIMESTAMP
        )";
        
        txn.exec_params(upsert_query, collection_id, user_id, permission_str, granting_user_id);
        txn.commit();
        
        std::cout << "Granted " << permission_str << " permission to user " << user_id 
                  << " for collection " << collection_id << " by user " << granting_user_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error granting permission: " << e.what() << std::endl;
        return false;
    }
}

/**
 * @brief Revoke a user's permission for a collection
 * @param collection_id Target collection
 * @param user_id User to revoke permission from
 * @param revoking_user_id User revoking the permission
 * @return true on success, false on failure
 */
bool CollectionManager::revokePermission(int collection_id, int user_id, int revoking_user_id) {
    try {
        // Check if revoking user has ADMIN permission or is owner
        if (!hasPermission(collection_id, revoking_user_id, CollectionPermission::ADMIN) &&
            getCollectionOwner(collection_id) != revoking_user_id) {
            std::cerr << "User " << revoking_user_id << " does not have permission to revoke access from collection " 
                      << collection_id << std::endl;
            return false;
        }
        
        // Cannot revoke permission from owner
        if (getCollectionOwner(collection_id) == user_id) {
            std::cerr << "Cannot revoke permission from collection owner" << std::endl;
            return false;
        }
        
        pqxx::work txn(*db_connection);
        
        std::string delete_query = R"(
            DELETE FROM collection_permissions 
            WHERE collection_id = $1 AND user_id = $2
        )";
        
        pqxx::result result = txn.exec_params(delete_query, collection_id, user_id);
        
        if (result.affected_rows() == 0) {
            std::cerr << "No explicit permission found for user " << user_id 
                      << " on collection " << collection_id << std::endl;
            return false;
        }
        
        txn.commit();
        
        std::cout << "Revoked permission from user " << user_id 
                  << " for collection " << collection_id << " by user " << revoking_user_id << std::endl;
        return true;
        
    } catch (const std::exception& e) {
        std::cerr << "Error revoking permission: " << e.what() << std::endl;
        return false;
    }
}

/**
 * @brief Get a user's permission level for a collection
 * @param collection_id Collection to check
 * @param user_id User to check
 * @return Permission level, nullopt if no access
 */
std::optional<CollectionPermission> CollectionManager::getUserPermission(int collection_id, int user_id) {
    try {
        pqxx::work txn(*db_connection);
        
        // Check if user is the owner (highest permission)
        std::string owner_query = "SELECT owner_id FROM collections WHERE id = $1";
        pqxx::result owner_result = txn.exec_params(owner_query, collection_id);
        
        if (owner_result.empty()) {
            return std::nullopt; // Collection doesn't exist
        }
        
        if (owner_result[0][0].as<int>() == user_id) {
            return CollectionPermission::ADMIN; // Owner has admin permission
        }
        
        // Check explicit permissions
        std::string permission_query = R"(
            SELECT permission_type FROM collection_permissions 
            WHERE collection_id = $1 AND user_id = $2
        )";
        pqxx::result permission_result = txn.exec_params(permission_query, collection_id, user_id);
        
        if (!permission_result.empty()) {
            std::string permission_str = permission_result[0][0].as<std::string>();
            return stringToPermission(permission_str);
        }
        
        // Check if collection is public (gives VIEW permission)
        std::string public_query = "SELECT is_public FROM collections WHERE id = $1";
        pqxx::result public_result = txn.exec_params(public_query, collection_id);
        
        if (!public_result.empty() && public_result[0][0].as<bool>()) {
            return CollectionPermission::VIEW;
        }
        
        return std::nullopt; // No access
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting user permission: " << e.what() << std::endl;
        return std::nullopt;
    }
}

/**
 * @brief Get all users with permissions for a collection
 * @param collection_id Collection identifier
 * @param requesting_user_id User requesting the information
 * @return Vector of user permissions
 */
std::vector<CollectionUserPermission> CollectionManager::getCollectionPermissions(int collection_id, 
                                                                                 int requesting_user_id) {
    std::vector<CollectionUserPermission> permissions;
    
    try {
        // Check if requesting user has ADMIN permission or is owner
        if (!hasPermission(collection_id, requesting_user_id, CollectionPermission::ADMIN) &&
            getCollectionOwner(collection_id) != requesting_user_id) {
            std::cerr << "User " << requesting_user_id << " does not have permission to view collection permissions" << std::endl;
            return permissions;
        }
        
        pqxx::work txn(*db_connection);
        
        std::string query = R"(
            SELECT cp.user_id, u.username, cp.permission_type, cp.granted_at, 
                   gb.username as granted_by_username
            FROM collection_permissions cp
            JOIN users u ON cp.user_id = u.id
            LEFT JOIN users gb ON cp.granted_by = gb.id
            WHERE cp.collection_id = $1
            ORDER BY cp.granted_at DESC
        )";
        
        pqxx::result result = txn.exec_params(query, collection_id);
        
        for (const auto& row : result) {
            auto permission = stringToPermission(row["permission_type"].as<std::string>());
            if (permission.has_value()) {
                CollectionUserPermission user_permission{
                    .user_id = row["user_id"].as<int>(),
                    .username = row["username"].as<std::string>(),
                    .permission = permission.value(),
                    .granted_at = row["granted_at"].as<std::string>(),
                    .granted_by_username = row["granted_by_username"].is_null() ? "System" : row["granted_by_username"].as<std::string>()
                };
                
                permissions.push_back(user_permission);
            }
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting collection permissions: " << e.what() << std::endl;
    }
    
    return permissions;
}

// ========== Utility Functions ==========

/**
 * @brief Convert permission enum to string
 * @param permission Permission enum value
 * @return String representation of permission
 */
std::string CollectionManager::permissionToString(CollectionPermission permission) {
    switch (permission) {
        case CollectionPermission::VIEW:      return "view";
        case CollectionPermission::ADD_BOOKS: return "add_books";
        case CollectionPermission::EDIT:      return "edit";
        case CollectionPermission::ADMIN:     return "admin";
        default:                              return "view";
    }
}

/**
 * @brief Convert string to permission enum
 * @param permission_str String representation
 * @return Permission enum value, nullopt if invalid
 */
std::optional<CollectionPermission> CollectionManager::stringToPermission(const std::string& permission_str) {
    if (permission_str == "view")       return CollectionPermission::VIEW;
    if (permission_str == "add_books")  return CollectionPermission::ADD_BOOKS;
    if (permission_str == "edit")       return CollectionPermission::EDIT;
    if (permission_str == "admin")      return CollectionPermission::ADMIN;
    return std::nullopt;
}

/**
 * @brief Get collection statistics
 * @param collection_id Collection identifier
 * @param user_id User requesting statistics
 * @return JSON object with statistics
 */
nlohmann::json CollectionManager::getCollectionStatistics(int collection_id, int user_id) {
    nlohmann::json stats = {
        {"error", "No access or collection not found"}
    };
    
    try {
        // Check if user has VIEW permission
        if (!hasPermission(collection_id, user_id, CollectionPermission::VIEW)) {
            return stats;
        }
        
        pqxx::work txn(*db_connection);
        
        // Basic collection info
        std::string basic_query = R"(
            SELECT c.name, c.description, c.created_at, u.username as owner,
                   COALESCE(book_count.count, 0) as total_books
            FROM collections c
            JOIN users u ON c.owner_id = u.id
            LEFT JOIN (
                SELECT collection_id, COUNT(*) as count 
                FROM collection_books 
                GROUP BY collection_id
            ) book_count ON c.id = book_count.collection_id
            WHERE c.id = $1
        )";
        
        pqxx::result basic_result = txn.exec_params(basic_query, collection_id);
        if (basic_result.empty()) {
            return stats;
        }
        
        auto row = basic_result[0];
        stats = {
            {"collection_name", row["name"].as<std::string>()},
            {"description", row["description"].is_null() ? "" : row["description"].as<std::string>()},
            {"owner", row["owner"].as<std::string>()},
            {"created_at", row["created_at"].as<std::string>()},
            {"total_books", row["total_books"].as<int>()}
        };
        
        // File types distribution
        std::string types_query = R"(
            SELECT b.file_type, COUNT(*) as count
            FROM collection_books cb
            JOIN books b ON cb.book_id = b.id
            WHERE cb.collection_id = $1
            GROUP BY b.file_type
            ORDER BY count DESC
        )";
        
        pqxx::result types_result = txn.exec_params(types_query, collection_id);
        nlohmann::json file_types = nlohmann::json::object();
        for (const auto& type_row : types_result) {
            file_types[type_row["file_type"].as<std::string>()] = type_row["count"].as<int>();
        }
        stats["file_types"] = file_types;
        
        // Recent additions (last 10)
        std::string recent_query = R"(
            SELECT b.title, b.author, cb.added_at, u.username as added_by
            FROM collection_books cb
            JOIN books b ON cb.book_id = b.id
            LEFT JOIN users u ON cb.added_by = u.id
            WHERE cb.collection_id = $1
            ORDER BY cb.added_at DESC
            LIMIT 10
        )";
        
        pqxx::result recent_result = txn.exec_params(recent_query, collection_id);
        nlohmann::json recent_books = nlohmann::json::array();
        for (const auto& recent_row : recent_result) {
            recent_books.push_back({
                {"title", recent_row["title"].as<std::string>()},
                {"author", recent_row["author"].is_null() ? "" : recent_row["author"].as<std::string>()},
                {"added_at", recent_row["added_at"].as<std::string>()},
                {"added_by", recent_row["added_by"].is_null() ? "Unknown" : recent_row["added_by"].as<std::string>()}
            });
        }
        stats["recent_additions"] = recent_books;
        
        // Activity stats for owners/admins
        if (hasPermission(collection_id, user_id, CollectionPermission::ADMIN) ||
            getCollectionOwner(collection_id) == user_id) {
            
            std::string activity_query = R"(
                SELECT u.username, COUNT(*) as books_added
                FROM collection_books cb
                LEFT JOIN users u ON cb.added_by = u.id
                WHERE cb.collection_id = $1
                GROUP BY u.username, cb.added_by
                ORDER BY books_added DESC
                LIMIT 10
            )";
            
            pqxx::result activity_result = txn.exec_params(activity_query, collection_id);
            nlohmann::json contributors = nlohmann::json::array();
            for (const auto& activity_row : activity_result) {
                contributors.push_back({
                    {"username", activity_row["username"].is_null() ? "Unknown" : activity_row["username"].as<std::string>()},
                    {"books_added", activity_row["books_added"].as<int>()}
                });
            }
            stats["contributors"] = contributors;
        }
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting collection statistics: " << e.what() << std::endl;
        stats = {{"error", e.what()}};
    }
    
    return stats;
}

// ========== Private Helper Functions ==========

/**
 * @brief Check if user has required permission level
 * @param collection_id Collection to check
 * @param user_id User to check
 * @param required_permission Minimum required permission
 * @return true if user has sufficient permission
 */
bool CollectionManager::hasPermission(int collection_id, int user_id, CollectionPermission required_permission) {
    auto user_permission = getUserPermission(collection_id, user_id);
    if (!user_permission.has_value()) {
        return false;
    }
    
    // Permission hierarchy: VIEW < ADD_BOOKS < EDIT < ADMIN
    int user_level = static_cast<int>(user_permission.value());
    int required_level = static_cast<int>(required_permission);
    
    return user_level >= required_level;
}

/**
 * @brief Get collection owner ID
 * @param collection_id Collection identifier
 * @return Owner user ID, -1 if collection doesn't exist
 */
int CollectionManager::getCollectionOwner(int collection_id) {
    try {
        pqxx::work txn(*db_connection);
        
        std::string query = "SELECT owner_id FROM collections WHERE id = $1";
        pqxx::result result = txn.exec_params(query, collection_id);
        
        if (result.empty()) {
            return -1;
        }
        
        return result[0][0].as<int>();
        
    } catch (const std::exception& e) {
        std::cerr << "Error getting collection owner: " << e.what() << std::endl;
        return -1;
    }
}

/**
 * @brief Update collection's last modified timestamp
 * @param collection_id Collection to update
 */
void CollectionManager::updateCollectionTimestamp(int collection_id) {
    try {
        pqxx::work txn(*db_connection);
        
        std::string query = "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = $1";
        txn.exec_params(query, collection_id);
        txn.commit();
        
    } catch (const std::exception& e) {
        std::cerr << "Error updating collection timestamp: " << e.what() << std::endl;
    }
}
