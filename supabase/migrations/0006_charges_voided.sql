-- Mensalidades excluídas ficam anuladas (ocupam a vaga da competência e não são geradas de novo).
alter table public.charges add column voided_at timestamptz;
