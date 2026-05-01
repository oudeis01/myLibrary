CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors TEXT[] NOT NULL DEFAULT '{}',
    format VARCHAR(10) NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    file_size BIGINT,
    page_count INTEGER,
    cover_path TEXT,
    description TEXT,
    year INTEGER,
    language VARCHAR(10),
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
