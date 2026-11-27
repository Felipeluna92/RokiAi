-- upsert de mensalidades via PostgREST precisa de constraint completa (setup tem competence NULL → nunca conflita).
drop index if exists public.charges_monthly_uidx;
alter table public.charges add constraint charges_client_type_competence_key unique (client_id, type, competence);
