/**
 * @file collection_manager.h
 * @brief Collection management system for MyLibrary - like Spotify playlists for books
 * 
 * This header defines the CollectionManager class that handles all collection-related
 * operations including creation, modification, sharing, and permission management.
 * Collections work like Spotify playlists where users can create book collections,
 * share them with others, and manage access permissions.
 * 
 * @author GitHub Copilot
 * @date 2025-08-25
 * @version 1.0
 */

#ifndef COLLECTION_MANAGER_H
#define COLLECTION_MANAGER_H

#include <string>
#include <vector>
#include <memory>
#include <optional>
#include <pqxx/pqxx>
#include <nlohmann/json.hpp>

/**
 * @brief Enumeration of permission types for collection access
 * 
 * Defines different levels of access that users can have to collections:
 * - VIEW: Can only view the collection and its books
 * - ADD_BOOKS: Can view and add books to the collection
 * - EDIT: Can view, add books, and modify collection details
 * - ADMIN: Full control including permission management
 */
enum class CollectionPermission {
    VIEW,       ///< Read-only access to collection
    ADD_BOOKS,  ///< Can add books to collection
    EDIT,       ///< Can modify collection details
    ADMIN       ///< Full administrative access
};

/**
 * @brief Structure representing a book collection
 * 
 * Contains all the information about a collection including metadata,
 * ownership, and visibility settings.
 */
struct Collection {
    int id;                          ///< Unique collection identifier
    std::string name;                ///< Collection display name
    std::string description;         ///< Optional collection description
    int owner_id;                    ///< User ID of the collection owner
    std::string owner_username;      ///< Username of the collection owner
    bool is_public;                  ///< Whether collection is publicly visible
    std::string created_at;          ///< Creation timestamp
    std::string updated_at;          ///< Last modification timestamp
    std::vector<int> book_ids;       ///< List of book IDs in this collection
    int book_count;                  ///< Number of books in collection
};

/**
 * @brief Structure representing a book within a collection context
 * 
 * Extends basic book information with collection-specific metadata
 * such as when it was added and by whom.
 */
struct CollectionBook {
    int book_id;                     ///< Book identifier
    std::string title;               ///< Book title
    std::string author;              ///< Book author
    std::string file_type;           ///< File format (epub, pdf, zip)
    std::string added_at;            ///< When book was added to collection
    std::string added_by_username;   ///< Who added the book
    int added_by_id;                 ///< User ID who added the book
};

/**
 * @brief Structure representing user permissions for a collection
 * 
 * Contains information about what a specific user can do with a collection.
 */
struct CollectionUserPermission {
    int user_id;                     ///< User identifier
    std::string username;            ///< Username
    CollectionPermission permission; ///< Permission level
    std::string granted_at;          ///< When permission was granted
    std::string granted_by_username; ///< Who granted the permission
};

/**
 * @brief Collection management class
 * 
 * This class provides comprehensive collection management functionality
 * similar to playlist systems in music streaming services. It handles:
 * - Collection CRUD operations
 * - Book addition/removal from collections
 * - Permission management and sharing
 * - Public/private collection visibility
 * - User access control
 * 
 * The class integrates with the existing Database class for connection
 * management and follows the same patterns as other manager classes.
 */
class CollectionManager {
public:
    /**
     * @brief Constructor
     * @param connection Shared database connection
     * 
     * Initializes the collection manager with a database connection.
     * The connection should be established and ready for use.
     */
    explicit CollectionManager(std::shared_ptr<pqxx::connection> connection);

    /**
     * @brief Destructor
     * 
     * Cleans up resources and ensures proper disconnection.
     */
    ~CollectionManager() = default;

    // ========== Collection CRUD Operations ==========

    /**
     * @brief Create a new collection
     * @param owner_id User ID of the collection owner
     * @param name Collection name (must be unique per user)
     * @param description Optional description of the collection
     * @param is_public Whether the collection should be publicly visible
     * @return Collection ID on success, -1 on failure
     * 
     * Creates a new collection owned by the specified user. The collection
     * name must be unique among the user's collections. Public collections
     * can be discovered by other users.
     */
    int createCollection(int owner_id, const std::string& name, 
                        const std::string& description = "", bool is_public = false);

    /**
     * @brief Get collection details by ID
     * @param collection_id Collection identifier
     * @param requesting_user_id User requesting the information
     * @return Collection object if found and accessible, nullopt otherwise
     * 
     * Retrieves complete collection information including book count.
     * Access is granted if the collection is public, owned by the user,
     * or the user has been granted permissions.
     */
    std::optional<Collection> getCollection(int collection_id, int requesting_user_id);

    /**
     * @brief Update collection metadata
     * @param collection_id Collection to update
     * @param user_id User performing the update
     * @param name New collection name (optional)
     * @param description New description (optional)
     * @param is_public New visibility setting (optional)
     * @return true on success, false on failure
     * 
     * Updates collection information. Requires EDIT or ADMIN permission.
     * If a parameter is empty, that field won't be updated.
     */
    bool updateCollection(int collection_id, int user_id, 
                         const std::string& name = "", 
                         const std::string& description = "", 
                         std::optional<bool> is_public = std::nullopt);

    /**
     * @brief Delete a collection
     * @param collection_id Collection to delete
     * @param user_id User requesting deletion
     * @return true on success, false on failure
     * 
     * Permanently deletes a collection and all its associations.
     * Only the owner or users with ADMIN permission can delete collections.
     * This also removes all book associations and permissions.
     */
    bool deleteCollection(int collection_id, int user_id);

    // ========== Collection Discovery ==========

    /**
     * @brief Get all collections owned by a user
     * @param user_id Owner's user ID
     * @return Vector of collections owned by the user
     * 
     * Returns all collections created by the specified user,
     * regardless of their visibility settings.
     */
    std::vector<Collection> getUserCollections(int user_id);

    /**
     * @brief Get collections accessible to a user
     * @param user_id User ID
     * @return Vector of accessible collections
     * 
     * Returns all collections the user can access including:
     * - Collections they own
     * - Public collections
     * - Collections they have been granted access to
     */
    std::vector<Collection> getAccessibleCollections(int user_id);

    /**
     * @brief Get public collections
     * @param limit Maximum number of collections to return
     * @param offset Number of collections to skip (for pagination)
     * @return Vector of public collections
     * 
     * Returns publicly visible collections for discovery.
     * Results are ordered by creation date (newest first).
     */
    std::vector<Collection> getPublicCollections(int limit = 50, int offset = 0);

    /**
     * @brief Search collections by name
     * @param query Search term
     * @param user_id User performing the search
     * @param search_public_only Whether to search only public collections
     * @return Vector of matching collections
     * 
     * Searches collection names using case-insensitive pattern matching.
     * If search_public_only is false, also searches user's accessible collections.
     */
    std::vector<Collection> searchCollections(const std::string& query, int user_id, 
                                            bool search_public_only = false);

    // ========== Book Management in Collections ==========

    /**
     * @brief Add a book to a collection
     * @param collection_id Target collection
     * @param book_id Book to add
     * @param user_id User performing the action
     * @return true on success, false on failure
     * 
     * Adds a book to the specified collection. Requires ADD_BOOKS permission
     * or higher. Prevents duplicate additions of the same book.
     */
    bool addBookToCollection(int collection_id, int book_id, int user_id);

    /**
     * @brief Remove a book from a collection
     * @param collection_id Source collection
     * @param book_id Book to remove
     * @param user_id User performing the action
     * @return true on success, false on failure
     * 
     * Removes a book from the collection. Requires ADD_BOOKS permission
     * or higher, or the user must be the one who added the book.
     */
    bool removeBookFromCollection(int collection_id, int book_id, int user_id);

    /**
     * @brief Get all books in a collection
     * @param collection_id Collection identifier
     * @param user_id User requesting the books
     * @return Vector of books in the collection
     * 
     * Returns all books in the collection with metadata about when
     * and by whom they were added. Requires VIEW permission or higher.
     */
    std::vector<CollectionBook> getCollectionBooks(int collection_id, int user_id);

    /**
     * @brief Check if a book is in a collection
     * @param collection_id Collection to check
     * @param book_id Book to look for
     * @param user_id User making the request
     * @return true if book is in collection and user can see it
     * 
     * Quick check for book membership in a collection.
     * Respects user permissions.
     */
    bool isBookInCollection(int collection_id, int book_id, int user_id);

    // ========== Permission Management ==========

    /**
     * @brief Grant permission to a user for a collection
     * @param collection_id Target collection
     * @param user_id User to grant permission to
     * @param permission Permission level to grant
     * @param granting_user_id User granting the permission
     * @return true on success, false on failure
     * 
     * Grants or updates a user's permission for a collection.
     * Only collection owners or users with ADMIN permission can grant permissions.
     * Cannot modify owner's permissions.
     */
    bool grantPermission(int collection_id, int user_id, 
                        CollectionPermission permission, int granting_user_id);

    /**
     * @brief Revoke a user's permission for a collection
     * @param collection_id Target collection
     * @param user_id User to revoke permission from
     * @param revoking_user_id User revoking the permission
     * @return true on success, false on failure
     * 
     * Removes a user's explicit permission for a collection.
     * Only owners or ADMIN users can revoke permissions.
     * Cannot revoke owner's implicit permissions.
     */
    bool revokePermission(int collection_id, int user_id, int revoking_user_id);

    /**
     * @brief Get a user's permission level for a collection
     * @param collection_id Collection to check
     * @param user_id User to check
     * @return Permission level, nullopt if no access
     * 
     * Determines the effective permission level for a user.
     * Considers ownership, explicit permissions, and public status.
     */
    std::optional<CollectionPermission> getUserPermission(int collection_id, int user_id);

    /**
     * @brief Get all users with permissions for a collection
     * @param collection_id Collection identifier
     * @param requesting_user_id User requesting the information
     * @return Vector of user permissions
     * 
     * Returns all users who have explicit permissions for the collection.
     * Only owners and ADMIN users can view this information.
     */
    std::vector<CollectionUserPermission> getCollectionPermissions(int collection_id, 
                                                                  int requesting_user_id);

    // ========== Utility Functions ==========

    /**
     * @brief Convert permission enum to string
     * @param permission Permission enum value
     * @return String representation of permission
     * 
     * Converts CollectionPermission enum to database-compatible string.
     */
    static std::string permissionToString(CollectionPermission permission);

    /**
     * @brief Convert string to permission enum
     * @param permission_str String representation
     * @return Permission enum value, nullopt if invalid
     * 
     * Converts database string to CollectionPermission enum.
     */
    static std::optional<CollectionPermission> stringToPermission(const std::string& permission_str);

    /**
     * @brief Get collection statistics
     * @param collection_id Collection identifier
     * @param user_id User requesting statistics
     * @return JSON object with statistics
     * 
     * Returns detailed statistics about a collection including:
     * - Total books
     * - File types distribution
     * - Recent additions
     * - User activity (for owners/admins)
     */
    nlohmann::json getCollectionStatistics(int collection_id, int user_id);

private:
    std::shared_ptr<pqxx::connection> db_connection; ///< Database connection

    /**
     * @brief Check if user has required permission level
     * @param collection_id Collection to check
     * @param user_id User to check
     * @param required_permission Minimum required permission
     * @return true if user has sufficient permission
     * 
     * Internal helper to verify user permissions before operations.
     */
    bool hasPermission(int collection_id, int user_id, CollectionPermission required_permission);

    /**
     * @brief Get collection owner ID
     * @param collection_id Collection identifier
     * @return Owner user ID, -1 if collection doesn't exist
     * 
     * Internal helper to quickly get collection ownership information.
     */
    int getCollectionOwner(int collection_id);

    /**
     * @brief Update collection's last modified timestamp
     * @param collection_id Collection to update
     * 
     * Internal helper to maintain updated_at timestamps.
     */
    void updateCollectionTimestamp(int collection_id);
};

#endif // COLLECTION_MANAGER_H
