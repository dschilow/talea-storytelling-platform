CREATE TABLE openai_prompt_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
