-- array_to_string is STABLE, not IMMUTABLE, so it cannot be used directly in a GIN index
-- expression. Wrap in an IMMUTABLE function so PostgreSQL allows index creation.
CREATE OR REPLACE FUNCTION book_search_vector(title text, authors text[], tags text[])
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT to_tsvector('simple'::regconfig,
    coalesce(title, '') || ' ' ||
    coalesce(array_to_string(authors, ' '), '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '')
  )
$$;

CREATE INDEX books_fts_idx ON books USING GIN (
  book_search_vector(title, authors, tags)
);

-- GIN index for efficient tag array containment queries
CREATE INDEX books_tags_idx ON books USING GIN (tags);
