create or replace function public.grant_first_user_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created_grant_admin on public.profiles;
create trigger on_profile_created_grant_admin
after insert on public.profiles
for each row execute function public.grant_first_user_admin();