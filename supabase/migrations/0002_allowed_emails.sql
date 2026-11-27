-- Só e-mails autorizados podem criar conta (sistema de usuário único).
create schema if not exists private;

create table private.allowed_emails (
  email text primary key check (email = lower(email))
);

create or replace function private.enforce_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from private.allowed_emails where email = lower(new.email)) then
    raise exception 'Cadastro não autorizado para este e-mail';
  end if;
  return new;
end $$;

revoke all on function private.enforce_allowed_email() from public, anon, authenticated;

create trigger enforce_allowed_email
before insert on auth.users
for each row execute function private.enforce_allowed_email();
