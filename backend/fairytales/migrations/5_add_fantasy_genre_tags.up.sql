-- Migration: Add "fantasy" genre tag to fairy tales with magical/adventure elements
-- This ensures fairy tales match common story genres like "fantasy"

-- Update Hänsel und Gretel
UPDATE fairy_tales 
SET genre_tags = '["fantasy", "adventure", "dark", "moral", "family"]'
WHERE id = 'grimm-015';

-- Update Rotkäppchen
UPDATE fairy_tales 
SET genre_tags = '["fantasy", "moral", "adventure", "animals"]'
WHERE id = 'grimm-026';

-- Update Die Bremer Stadtmusikanten
UPDATE fairy_tales 
SET genre_tags = '["fantasy", "adventure", "animals", "teamwork", "humor"]'
WHERE id = 'grimm-027';

-- Add fantasy to all tales with "adventure" or "magic" elements
UPDATE fairy_tales
SET genre_tags = REPLACE(genre_tags::text, '["adventure"', '["fantasy", "adventure"')::text
WHERE genre_tags::text LIKE '%"adventure"%' 
  AND genre_tags::text NOT LIKE '%"fantasy"%';

-- Add fantasy to tales with "magic" elements
UPDATE fairy_tales
SET genre_tags = REPLACE(genre_tags::text, '["magic"', '["fantasy", "magic"')::text
WHERE genre_tags::text LIKE '%"magic"%' 
  AND genre_tags::text NOT LIKE '%"fantasy"%';

-- Verify changes
-- SELECT id, title, genre_tags FROM fairy_tales WHERE genre_tags::text LIKE '%fantasy%';
