-- Create schema for the flashcard application
CREATE SCHEMA IF NOT EXISTS srs;

-- Users table with authentication fields
CREATE TABLE IF NOT EXISTS srs.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(50) NOT NULL DEFAULT 'student', -- 'student' or 'teacher'
    picture_password VARCHAR(255), -- For picture-based authentication
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards table (flashcard content)
CREATE TABLE IF NOT EXISTS srs.cards (
    id SERIAL PRIMARY KEY,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Card state table (tracks user's progress on each card) - this replaces user_cards
CREATE TABLE IF NOT EXISTS srs.card_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES srs.users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES srs.cards(id) ON DELETE CASCADE,
    due_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    interval_days INTEGER DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    reps INTEGER DEFAULT 0, -- renamed from repetitions for consistency
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);

-- Student progress tracking table
CREATE TABLE IF NOT EXISTS srs.student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES srs.users(id) ON DELETE CASCADE,
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    cards_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Reviews table for analytics
CREATE TABLE IF NOT EXISTS srs.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES srs.users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES srs.cards(id) ON DELETE CASCADE,
    grade VARCHAR(20) NOT NULL CHECK (grade IN ('again', 'hard', 'good', 'easy')),
    rating INTEGER NOT NULL DEFAULT 2 CHECK (rating BETWEEN 0 AND 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
DECLARE
  rating_exists BOOLEAN;
  grade_exists BOOLEAN;
  rating_type TEXT;
  rating_udt TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'srs'
       AND table_name = 'reviews'
       AND column_name = 'rating'
  ) INTO rating_exists;

  IF rating_exists THEN
    SELECT data_type, udt_schema || '.' || udt_name
      INTO rating_type, rating_udt
      FROM information_schema.columns
     WHERE table_schema = 'srs'
       AND table_name = 'reviews'
       AND column_name = 'rating';

    IF rating_type = 'USER-DEFINED' THEN
      EXECUTE $conv$
        ALTER TABLE srs.reviews
          ALTER COLUMN rating DROP DEFAULT,
          ALTER COLUMN rating TYPE INTEGER
          USING CASE rating::text
                 WHEN 'again' THEN 0
                 WHEN 'hard' THEN 1
                 WHEN 'good' THEN 2
                 WHEN 'easy' THEN 3
                 ELSE 2
               END
      $conv$;
    ELSIF rating_type IN ('character varying', 'text') THEN
      EXECUTE $conv$
        ALTER TABLE srs.reviews
          ALTER COLUMN rating DROP DEFAULT,
          ALTER COLUMN rating TYPE INTEGER
          USING CASE rating
                 WHEN 'again' THEN 0
                 WHEN 'hard' THEN 1
                 WHEN 'good' THEN 2
                 WHEN 'easy' THEN 3
                 WHEN '0' THEN 0
                 WHEN '1' THEN 1
                 WHEN '2' THEN 2
                 WHEN '3' THEN 3
                 ELSE 2
               END
      $conv$;
    ELSIF rating_type IS NOT NULL AND rating_type <> 'integer' THEN
      EXECUTE $conv$
        ALTER TABLE srs.reviews
          ALTER COLUMN rating DROP DEFAULT,
          ALTER COLUMN rating TYPE INTEGER
          USING rating::integer
      $conv$;
    END IF;
  ELSE
    EXECUTE $conv$
      ALTER TABLE srs.reviews
        ADD COLUMN rating INTEGER
    $conv$;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'srs'
       AND table_name = 'reviews'
       AND column_name = 'grade'
  ) INTO grade_exists;

  IF NOT grade_exists THEN
    EXECUTE $conv$
      ALTER TABLE srs.reviews
        ADD COLUMN grade VARCHAR(20)
    $conv$;
  END IF;
END$$;

UPDATE srs.reviews
   SET rating = CASE
                 WHEN rating IS NULL AND grade IS NOT NULL THEN
                   CASE grade
                     WHEN 'again' THEN 0
                     WHEN 'hard' THEN 1
                     WHEN 'good' THEN 2
                     WHEN 'easy' THEN 3
                     ELSE 2
                   END
                 ELSE rating
               END;

UPDATE srs.reviews
   SET grade = CASE
                 WHEN grade IS NULL AND rating IS NOT NULL THEN
                   CASE rating
                     WHEN 0 THEN 'again'
                     WHEN 1 THEN 'hard'
                     WHEN 2 THEN 'good'
                     WHEN 3 THEN 'easy'
                     ELSE 'good'
                   END
                 ELSE COALESCE(grade, 'good')
               END;

ALTER TABLE srs.reviews
  ALTER COLUMN rating SET DEFAULT 2;

ALTER TABLE srs.reviews
  ALTER COLUMN rating SET NOT NULL;

ALTER TABLE srs.reviews
  ALTER COLUMN grade SET DEFAULT 'good';

ALTER TABLE srs.reviews
  ALTER COLUMN grade SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE srs.reviews
    ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 0 AND 3);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE srs.reviews
    ADD CONSTRAINT reviews_grade_check CHECK (grade IN ('again', 'hard', 'good', 'easy'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_srs_users_username ON srs.users(username);
CREATE INDEX IF NOT EXISTS idx_srs_users_type ON srs.users(user_type);
CREATE INDEX IF NOT EXISTS idx_srs_card_state_user_id ON srs.card_state(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_card_state_due_at ON srs.card_state(due_at);
CREATE INDEX IF NOT EXISTS idx_srs_card_state_card_id ON srs.card_state(card_id);
CREATE INDEX IF NOT EXISTS idx_srs_student_progress_user_id ON srs.student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_reviews_user_id ON srs.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_srs_reviews_created_at ON srs.reviews(created_at);

-- Insert sample data for testing

-- Insert sample users
INSERT INTO srs.users (username, display_name, user_type, picture_password, email) VALUES 
('student1', 'Student One', 'student', 'cat123', 'student1@example.com'),
('teacher1', 'Teacher One', 'teacher', 'dog456', 'teacher1@example.com')
ON CONFLICT (username) DO NOTHING;

-- Insert multiplication flashcards (12x12 as mentioned in the app)
INSERT INTO srs.cards (front, back) VALUES
('3 × 4', '12'),
('6 × 7', '42'),
('8 × 9', '72'),
('11 × 12', '132'),
('5 × 8', '40'),
('9 × 9', '81'),
('7 × 6', '42'),
('12 × 10', '120'),
('4 × 7', '28'),
('3 × 12', '36')
ON CONFLICT DO NOTHING;

-- Initialize student progress
INSERT INTO srs.student_progress (user_id, total_reviews, correct_reviews, cards_completed)
SELECT u.id, 0, 0, 0
FROM srs.users u
WHERE u.user_type = 'student'
ON CONFLICT (user_id) DO NOTHING;

-- Initialize card states for student users
INSERT INTO srs.card_state (user_id, card_id, due_at, interval_days, ease_factor, reps)
SELECT 
    u.id,
    c.id,
    NOW() - INTERVAL '1 day',  -- Due yesterday for immediate review
    CASE WHEN c.id % 3 = 0 THEN 3 ELSE 1 END,  -- Some cards have longer intervals
    CASE WHEN c.id % 2 = 0 THEN 2.8 ELSE 2.5 END,  -- Some cards have higher ease factor
    CASE WHEN c.id % 4 = 0 THEN 2 ELSE 0 END  -- Some cards have been reviewed before
FROM srs.users u, srs.cards c
WHERE u.user_type = 'student'
ON CONFLICT (user_id, card_id) DO NOTHING;
