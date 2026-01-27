-- ============================================
-- Rate Limit Migration
-- ============================================

-- Create table to track OTP requests
CREATE TABLE IF NOT EXISTS otp_requests (
    email TEXT PRIMARY KEY,
    last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE otp_requests ENABLE ROW LEVEL SECURITY;

-- Create function to check and update rate limit
-- This function is SECURITY DEFINER to allow access to the table
-- while controlling the logic strictly.
CREATE OR REPLACE FUNCTION check_and_update_rate_limit(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    last_request TIMESTAMPTZ;
    limit_interval INTERVAL := '2 minutes'; -- 2 minutes rate limit
BEGIN
    -- Check if record exists
    SELECT last_request_at INTO last_request
    FROM otp_requests
    WHERE email = p_email;

    IF last_request IS NOT NULL THEN
        -- Check if within limit
        IF NOW() - last_request < limit_interval THEN
            RETURN FALSE; -- Rate limited
        END IF;

        -- Update timestamp
        UPDATE otp_requests
        SET last_request_at = NOW()
        WHERE email = p_email;
    ELSE
        -- Insert new record
        INSERT INTO otp_requests (email, last_request_at)
        VALUES (p_email, NOW());
    END IF;

    RETURN TRUE; -- Allowed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION check_and_update_rate_limit(TEXT) TO anon, authenticated, service_role;
