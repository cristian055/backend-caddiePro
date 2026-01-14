-- Migration: Refactor Queue Architecture
-- Date: 2026-01-13
-- Description: Separate operational queue state from permanent caddie data, add enums, remove redundant fields

-- ============================================
-- Step 1: Create Enums
-- ============================================

-- Create UserRole enum type
DO $$ BEGIN
    CREATE TYPE UserRole AS ENUM ('ADMIN', 'OPERATOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CaddieRole enum type
DO $$ BEGIN
    CREATE TYPE CaddieRole AS ENUM ('GOLF', 'TENNIS', 'HYBRID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CaddieCategory enum type
DO $$ BEGIN
    CREATE TYPE CaddieCategory AS ENUM ('PRIMERA', 'SEGUNDA', 'TERCERA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create CaddieOperationalStatus enum type
DO $$ BEGIN
    CREATE TYPE CaddieOperationalStatus AS ENUM ('AVAILABLE', 'IN_PREP', 'IN_FIELD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create AttendanceStatus enum type
DO $$ BEGIN
    CREATE TYPE AttendanceStatus AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create OrderType enum type
DO $$ BEGIN
    CREATE TYPE OrderType AS ENUM ('ASC', 'DESC', 'RANDOM', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create DayOfWeek enum type
DO $$ BEGIN
    CREATE TYPE DayOfWeek AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create AvailabilityRangeType enum type
DO $$ BEGIN
    CREATE TYPE AvailabilityRangeType AS ENUM ('FULL', 'BEFORE', 'AFTER', 'BETWEEN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Step 2: Create queue_positions table
-- ============================================

CREATE TABLE IF NOT EXISTS queue_positions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    caddie_id TEXT NOT NULL REFERENCES caddies(id) ON DELETE CASCADE,
    category CaddieCategory NOT NULL,
    position INTEGER NOT NULL,
    operational_status CaddieOperationalStatus DEFAULT 'AVAILABLE',
    last_dispatched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, position)
);

-- ============================================
-- Step 3: Migrate existing caddie status to queue_positions
-- ============================================

-- Backfill existing caddies into queue_positions
-- This assumes all existing caddies are in AVAILABLE status
-- and uses their current category with incremental positions
INSERT INTO queue_positions (caddie_id, category, position, operational_status)
SELECT 
    c.id,
    COALESCE(c.category::text::CaddieCategory, 'TERCERA') as category,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(c.category, 'Tercera') ORDER BY c.number) as position,
    CASE 
        WHEN c.status IN ('AVAILABLE', 'IN_PREP', 'IN_FIELD') THEN c.status::text::CaddieOperationalStatus
        ELSE 'AVAILABLE'
    END as operational_status
FROM caddies c
WHERE c.is_active = true
ON CONFLICT (category, position) DO NOTHING;

-- ============================================
-- Step 4: Update User table with new enum
-- ============================================

-- Update User.role column
ALTER TABLE users 
    ALTER COLUMN role TYPE UserRole 
    USING CASE role 
        WHEN 'admin' THEN 'ADMIN'::UserRole
        WHEN 'operator' THEN 'OPERATOR'::UserRole
        ELSE 'OPERATOR'::UserRole
    END,
    ALTER COLUMN role SET DEFAULT 'OPERATOR';

-- ============================================
-- Step 5: Update Caddie table with new enums and remove redundant fields
-- ============================================

-- Add default value for category if NULL
UPDATE caddies SET category = 'Tercera' WHERE category IS NULL;

-- Convert category to enum
ALTER TABLE caddies 
    ALTER COLUMN category TYPE CaddieCategory 
    USING UPPER(TRIM(category))::text::CaddieCategory,
    ALTER COLUMN category SET DEFAULT 'TERCERA',
    ALTER COLUMN category SET NOT NULL;

-- Convert role to enum
ALTER TABLE caddies 
    ALTER COLUMN role TYPE CaddieRole 
    USING UPPER(TRIM(role))::text::CaddieRole,
    ALTER COLUMN role SET DEFAULT 'GOLF';

-- Drop redundant counter fields
ALTER TABLE caddies 
    DROP COLUMN IF EXISTS history_count,
    DROP COLUMN IF EXISTS absences_count,
    DROP COLUMN IF EXISTS late_count,
    DROP COLUMN IF EXISTS leave_count;

-- ============================================
-- Step 6: Update DailyAttendance with new enum
-- ============================================

-- Convert status to enum
ALTER TABLE daily_attendance 
    ALTER COLUMN status TYPE AttendanceStatus 
    USING UPPER(TRIM(status))::text::AttendanceStatus;

-- ============================================
-- Step 7: Update ListConfig with new enums
-- ============================================

-- Convert orderType to enum
ALTER TABLE list_configs 
    ALTER COLUMN order_type TYPE OrderType 
    USING UPPER(TRIM(order_type))::text::OrderType,
    ALTER COLUMN order_type SET DEFAULT 'ASC';

-- Convert category to enum
ALTER TABLE list_configs 
    ALTER COLUMN category TYPE CaddieCategory 
    USING UPPER(TRIM(category))::text::CaddieCategory;

-- ============================================
-- Step 8: Update WeeklyShift with new enum
-- ============================================

-- Convert day to enum
ALTER TABLE weekly_shifts 
    ALTER COLUMN day TYPE DayOfWeek 
    USING UPPER(TRIM(day))::text::DayOfWeek;

-- ============================================
-- Step 9: Update WeeklyShiftRequirement with new enum
-- ============================================

-- Convert category to enum
ALTER TABLE weekly_shift_requirements 
    ALTER COLUMN category TYPE CaddieCategory 
    USING UPPER(TRIM(category))::text::CaddieCategory;

-- ============================================
-- Step 10: Update WeeklyAssignment (remove redundant fields)
-- ============================================

-- Drop redundant fields
ALTER TABLE weekly_assignments 
    DROP COLUMN IF EXISTS caddie_name,
    DROP COLUMN IF EXISTS caddie_number,
    DROP COLUMN IF EXISTS category;

-- ============================================
-- Step 11: Update CaddieAvailability with new enum
-- ============================================

-- Convert day to enum
ALTER TABLE caddie_availability 
    ALTER COLUMN day TYPE DayOfWeek 
    USING UPPER(TRIM(day))::text::DayOfWeek;

-- Convert rangeType to enum
ALTER TABLE caddie_availability 
    ALTER COLUMN range_type TYPE AvailabilityRangeType 
    USING LOWER(TRIM(range_type))::text::AvailabilityRangeType;

-- ============================================
-- Step 12: Update DispatchHistory with new enum
-- ============================================

-- Convert status fields to enum
ALTER TABLE dispatch_history 
    ALTER COLUMN previous_status TYPE CaddieOperationalStatus 
    USING UPPER(TRIM(previous_status))::text::CaddieOperationalStatus,
    ALTER COLUMN new_status TYPE CaddieOperationalStatus 
    USING UPPER(TRIM(new_status))::text::CaddieOperationalStatus;

-- ============================================
-- Step 13: Update Message table with new enum
-- ============================================

-- Convert targetCategory to enum
ALTER TABLE messages 
    ALTER COLUMN target_category TYPE CaddieCategory 
    USING UPPER(TRIM(target_category))::text::CaddieCategory;

-- ============================================
-- Step 14: Add Composite Indexes
-- ============================================

-- Index for Users
CREATE INDEX IF NOT EXISTS users_role_is_active ON users(role, is_active);

-- Index for Caddies
CREATE INDEX IF NOT EXISTS caddies_location_category_is_active ON caddies(location, category, is_active);

-- Index for Queue Positions
CREATE INDEX IF NOT EXISTS queue_positions_category_operational_status ON queue_positions(category, operational_status);

-- Index for Daily Attendance
CREATE INDEX IF NOT EXISTS daily_attendance_date ON daily_attendance(date);

-- Index for Dispatch History
CREATE INDEX IF NOT EXISTS dispatch_history_location_dispatched_at ON dispatch_history(location, dispatched_at);

-- ============================================
-- Step 15: Create trigger for updating queue_positions.updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_queue_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_positions_updated_at
    BEFORE UPDATE ON queue_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_positions_updated_at();

-- ============================================
-- Step 16: Verification queries
-- ============================================

-- Verify enums created
SELECT 
    'Enums created' as check,
    array_agg(typname ORDER BY typname) as enum_types
FROM pg_type
WHERE typname IN (
    'UserRole', 'CaddieRole', 'CaddieCategory', 'CaddieOperationalStatus',
    'AttendanceStatus', 'OrderType', 'DayOfWeek', 'AvailabilityRangeType'
);

-- Verify queue_positions table exists and has data
SELECT 
    'Queue positions initialized' as check,
    COUNT(*) as count
FROM queue_positions;

-- Verify redundant columns removed from Caddie
SELECT 
    'Redundant columns removed' as check,
    COUNT(*) as remaining_columns
FROM information_schema.columns
WHERE table_name = 'caddies'
AND column_name IN ('history_count', 'absences_count', 'late_count', 'leave_count');

-- Verify redundant columns removed from WeeklyAssignment
SELECT 
    'WeeklyAssignment columns cleaned' as check,
    COUNT(*) as remaining_columns
FROM information_schema.columns
WHERE table_name = 'weekly_assignments'
AND column_name IN ('caddie_name', 'caddie_number', 'category');

-- Verify indexes created
SELECT 
    'Indexes created' as check,
    array_agg(indexname ORDER BY indexname) as index_names
FROM pg_indexes
WHERE indexname IN (
    'users_role_is_active',
    'caddies_location_category_is_active',
    'queue_positions_category_operational_status',
    'daily_attendance_date',
    'dispatch_history_location_dispatched_at'
);

-- ============================================
-- Summary
-- ============================================

SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_queue_positions,
    COUNT(DISTINCT category) as categories_migrated
FROM queue_positions;
