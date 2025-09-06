-- Test script for reset token migration with rate limiting
-- Run this after applying the migration to verify everything works

-- Test 1: Check if columns exist
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('resetToken', 'resetTokenRequestedAt')
ORDER BY column_name;

-- Test 2: Check if index exists
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'users' 
    AND indexname = 'idx_users_reset_token';

-- Test 3: Check table structure
\d users

-- Test 4: Check column comments
SELECT 
    col_description(c.oid, c.attnum) as comment,
    c.attname as column_name
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE c.relname = 'users' 
    AND a.attname IN ('resetToken', 'resetTokenRequestedAt');

-- Test 5: Verify no old columns exist (if this was a migration from old system)
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name LIKE '%ExpiresAt%';

-- Test 6: Simulate rate limiting logic (application level test)
-- This shows how the rate limiting would work in practice
WITH test_scenarios AS (
    SELECT 
        'First request' as scenario,
        NOW() as request_time,
        NULL::timestamp as last_request_time,
        'Should succeed' as expected_result
    UNION ALL
    SELECT 
        'Request within 1 minute' as scenario,
        NOW() as request_time,
        NOW() - INTERVAL '30 seconds' as last_request_time,
        'Should fail - rate limited' as expected_result
    UNION ALL
    SELECT 
        'Request after 1 minute' as scenario,
        NOW() as request_time,
        NOW() - INTERVAL '65 seconds' as last_request_time,
        'Should succeed' as expected_result
    UNION ALL
    SELECT 
        'Token expiration check' as scenario,
        NOW() as request_time,
        NOW() - INTERVAL '25 hours' as last_request_time,
        'Should fail - expired' as expected_result
)
SELECT 
    scenario,
    request_time,
    last_request_time,
    CASE 
        WHEN last_request_time IS NULL THEN 'First request - allowed'
        WHEN (request_time - last_request_time) < INTERVAL '1 minute' THEN 'Rate limited - too soon'
        WHEN (request_time - last_request_time) >= INTERVAL '1 minute' THEN 'Allowed - sufficient time passed'
    END as rate_limit_check,
    CASE 
        WHEN last_request_time IS NULL THEN 'Valid - first request'
        WHEN (request_time - last_request_time) <= INTERVAL '24 hours' THEN 'Valid - within expiration'
        ELSE 'Expired - beyond 24 hours'
    END as expiration_check,
    expected_result
FROM test_scenarios;

-- Test 7: Check data types and constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'users' 
    AND kcu.column_name IN ('resetToken', 'resetTokenRequestedAt');

-- Expected results:
-- 1. Should see resetToken and resetTokenRequestedAt columns
-- 2. Should see idx_users_reset_token index
-- 3. Should see proper comments on columns
-- 4. Should NOT see any ExpiresAt columns
-- 5. Rate limiting scenarios should show correct logic
-- 6. No foreign key constraints on reset token columns
-- 7. resetTokenRequestedAt should be timestamp with time zone