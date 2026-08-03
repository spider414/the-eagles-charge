-- Seed default email branding + templates. Run AFTER 01_schema.sql.
insert into public.email_settings (brand_name, logo_emoji, primary_color, dark_color, header_tagline, footer_text, support_email, from_address)
select 'The Eagles Charge','🦅','#16a34a','#0f172a','','','harrison@harmicglobal.com','The Eagles Charge <noreply@harmicglobal.com>'
where not exists (select 1 from public.email_settings);

insert into public.email_templates (template_key, subject, intro, outro, enabled) values
('welcome','Welcome to The Eagles Charge 🦅','Your Eagles Charge account is ready. Buy airtime, data, pay electricity, cable, and more — instantly, at the best rates.','Log in anytime and fund your wallet to get started.',true),
('receipt','Your Eagles Charge Receipt','Your transaction was processed. Here''s your receipt.','Keep this email as proof of payment. If anything looks off, reply within 24 hours.',true),
('password_reset','Your Eagles Charge password was reset','The password for your Eagles Charge account was just reset successfully.','If you did not perform this action, please contact support immediately.',true)
on conflict (template_key) do nothing;

-- Grant yourself admin AFTER you have signed up on the new project:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR_LOGIN_EMAIL' on conflict do nothing;
