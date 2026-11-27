-- ON CONFLICT via PostgREST precisa de uma constraint completa (NULLs continuam distintos).
drop index if exists public.leads_owner_place_uidx;
alter table public.leads add constraint leads_owner_place_key unique (owner_id, google_place_id);
