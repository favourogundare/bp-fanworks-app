-- Full-text search over posts (title weighted above body).
--
-- A stored generated column keeps the tsvector in sync automatically — no
-- triggers to maintain. The GIN index makes websearch queries fast, and the
-- client hits it via PostgREST's textSearch (websearch_to_tsquery), which is
-- parameterized — user input never reaches SQL directly.

alter table posts add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,  '')), 'B')
  ) stored;

create index if not exists posts_search_idx on posts using gin (search_tsv);
