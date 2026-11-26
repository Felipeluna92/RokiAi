export type ChargeStatus = 'paga' | 'a_vencer' | 'vence_hoje' | 'atrasada'

export function chargeStatus(c: { due_date: string; paid_at: string | null }, today: string): ChargeStatus {
  if (c.paid_at) return 'paga'
  if (c.due_date < today) return 'atrasada'
  if (c.due_date === today) return 'vence_hoje'
  return 'a_vencer'
}

export const STATUS_LABEL: Record<ChargeStatus, string> = {
  paga: 'Paga',
  a_vencer: 'A vencer',
  vence_hoje: 'Vence hoje',
  atrasada: 'Atrasada',
}
