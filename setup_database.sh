#!/bin/bash

# MyLibrary Database Setup Script
# This script sets up PostgreSQL database for MyLibrary server

set -e

echo "🔧 MyLibrary Database Setup"
echo "=========================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Installing..."
    
    # Detect the Linux distribution
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib libpqxx-dev
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL/Fedora
        sudo yum install -y postgresql postgresql-server postgresql-contrib libpqxx-devel
        sudo postgresql-setup initdb
    else
        echo "❌ Unsupported Linux distribution. Please install PostgreSQL manually."
        exit 1
    fi
fi

# Start PostgreSQL service
echo "🚀 Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check if database already exists
DB_EXISTS=$(sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -w mylibrary_db | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo "📊 Creating database and user..."
    
    # Create database and user
    sudo -u postgres createdb mylibrary_db
    sudo -u postgres createuser mylibrary_user
    sudo -u postgres psql -c "ALTER USER mylibrary_user WITH PASSWORD 'your_password_here';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mylibrary_db TO mylibrary_user;"
    
    echo "✅ Database and user created successfully!"
else
    echo "ℹ️  Database already exists."
fi

# Create tables
echo "📋 Creating tables..."
sudo -u postgres psql -d mylibrary_db -f "$(dirname "$0")/setup_db.sql"

echo "✅ Database setup completed!"
echo ""
echo "📝 Database connection details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: mylibrary_db"
echo "   User: mylibrary_user"
echo "   Password: your_password_here"
echo ""
echo "🚀 You can now start the MyLibrary server:"
echo "   cd build && ./mylibrary_server"
