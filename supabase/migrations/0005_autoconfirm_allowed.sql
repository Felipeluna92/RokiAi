-- E-mails autorizados já entram confirmados (o link de confirmação do Supabase apontaria para localhost).
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
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;
