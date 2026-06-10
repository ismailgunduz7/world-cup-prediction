-- Refresh-token rotation grace window.
--
-- Rotation previously hard-deleted the old token row the instant a new one was
-- issued. Two near-simultaneous refreshes sharing the same cookie (multiple
-- tabs, or a page reload that aborts an in-flight refresh before its Set-Cookie
-- arrives) then raced: the first deleted the row, the second found nothing and
-- failed, clearing the cookie and bouncing the user to the login screen.
--
-- Instead of deleting, rotation now stamps rotated_at. Peers presenting the
-- same token within a short grace window are still honored; a token reused long
-- after rotation is treated as a replay and rejected.
ALTER TABLE refresh_tokens ADD COLUMN rotated_at TIMESTAMPTZ;

-- Supports opportunistic cleanup of rows lingering past their grace window.
CREATE INDEX idx_refresh_tokens_rotated_at ON refresh_tokens(rotated_at);
