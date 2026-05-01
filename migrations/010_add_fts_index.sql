-- Full-text search index on title, authors, and tags
CREATE INDEX books_fts_idx ON books USING GIN (
  to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(array_to_string(authors, ' '), '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '')
  )
);

-- GIN index for efficient tag array containment queries
CREATE INDEX books_tags_idx ON books USING GIN (tags);
