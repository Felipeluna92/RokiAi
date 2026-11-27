-- Estrelas, avaliações e potencial do comércio no momento em que virou lead (para priorizar a abordagem).
alter table public.leads
  add column rating numeric(2,1) check (rating between 0 and 5),
  add column ratings_count int check (ratings_count >= 0),
  add column potential_score int check (potential_score between 0 and 100);
