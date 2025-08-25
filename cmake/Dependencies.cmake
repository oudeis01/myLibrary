# Dependencies.cmake
# Optimized dependency management for faster builds
# This file handles dependency management with caching to reduce build times

# Set up faster dependency management
set(FETCHCONTENT_QUIET ON)
set(FETCHCONTENT_UPDATES_DISCONNECTED ON)

# Use local cache for dependencies to avoid repeated downloads
set(FETCHCONTENT_BASE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/.deps_cache")

# Check if we have cached versions
set(JSON_CACHE_DIR "${FETCHCONTENT_BASE_DIR}/json-src")
set(HTTPLIB_CACHE_DIR "${FETCHCONTENT_BASE_DIR}/httplib-src")

# Helper function to check if dependency exists locally
function(check_local_dependency dep_name dep_path)
    if(EXISTS "${dep_path}")
        message(STATUS "Using cached ${dep_name} from ${dep_path}")
        set(USE_CACHED_${dep_name} TRUE PARENT_SCOPE)
    else()
        message(STATUS "Downloading ${dep_name} (will be cached for future builds)")
        set(USE_CACHED_${dep_name} FALSE PARENT_SCOPE)
    endif()
endfunction()

# Check for cached dependencies
check_local_dependency(JSON "${JSON_CACHE_DIR}")
check_local_dependency(HTTPLIB "${HTTPLIB_CACHE_DIR}")

# Fetch nlohmann/json with caching
if(NOT USE_CACHED_JSON)
    FetchContent_Declare(
      json
      GIT_REPOSITORY https://github.com/nlohmann/json.git
      GIT_TAG v3.11.3
      GIT_SHALLOW TRUE
      GIT_PROGRESS TRUE
      SOURCE_DIR "${JSON_CACHE_DIR}"
    )
else()
    FetchContent_Declare(
      json
      SOURCE_DIR "${JSON_CACHE_DIR}"
    )
endif()

# Fetch cpp-httplib with caching
if(NOT USE_CACHED_HTTPLIB)
    FetchContent_Declare(
      httplib
      GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
      GIT_TAG v0.14.3
      GIT_SHALLOW TRUE
      GIT_PROGRESS TRUE
      SOURCE_DIR "${HTTPLIB_CACHE_DIR}"
    )
else()
    FetchContent_Declare(
      httplib
      SOURCE_DIR "${HTTPLIB_CACHE_DIR}"
    )
endif()

# Make dependencies available
FetchContent_MakeAvailable(json httplib)
