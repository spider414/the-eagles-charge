UPDATE public.email_settings SET support_email = 'harmicrecharge@harmicglobal.com', brand_name = 'HARMIC RECHARGE', from_address = 'HARMIC RECHARGE <noreply@harmicglobal.com>';

UPDATE public.email_templates SET subject = 'Welcome to HARMIC RECHARGE', intro = 'Your HARMIC RECHARGE account is ready. Buy airtime, data, pay electricity, cable, and more — instantly, at the best rates.' WHERE template_key = 'welcome';
UPDATE public.email_templates SET subject = 'Your HARMIC RECHARGE Receipt' WHERE template_key = 'receipt';
UPDATE public.email_templates SET subject = 'Your HARMIC RECHARGE password was reset', intro = 'The password for your HARMIC RECHARGE account was just reset successfully.' WHERE template_key = 'password_reset';
UPDATE public.email_templates SET subject = replace(subject, 'Eagles Charge', 'HARMIC RECHARGE'), intro = replace(intro, 'Eagles Charge', 'HARMIC RECHARGE'), outro = replace(outro, 'Eagles Charge', 'HARMIC RECHARGE');