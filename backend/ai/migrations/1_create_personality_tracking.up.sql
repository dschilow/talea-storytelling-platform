CREATE TYPE content_type_enum AS ENUM('story', 'doku', 'quiz');

CREATE TABLE personality_updates (
    id VARCHAR(36) PRIMARY KEY,
    avatar_id VARCHAR(36) NOT NULL,
    content_id VARCHAR(36) NOT NULL,
    content_type content_type_enum NOT NULL,
    content_title VARCHAR(255) NOT NULL,
    changes_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each avatar can only get updates once per content
    CONSTRAINT unique_avatar_content UNIQUE (avatar_id, content_id, content_type)
);

-- Indexes for performance
CREATE INDEX idx_avatar_id ON personality_updates (avatar_id);
CREATE INDEX idx_content ON personality_updates (content_id, content_type);
CREATE INDEX idx_created_at ON personality_updates (created_at);