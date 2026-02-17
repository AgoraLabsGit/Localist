-- Promote first admin: set role='admin' for your email.
-- Run this after signing up, then sign in and visit /admin.
-- Change the email to your own before running.
UPDATE users SET role = 'admin' WHERE email = 'currieralex@gmail.com';
