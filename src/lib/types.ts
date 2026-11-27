import type { Stage } from './billing/metrics'
import type { TemplateKind } from './messages'

export type Settings = {
  id: string
  business_name: string | null
  pix_key: string | null
  default_setup_price: number | null
  default_monthly_price: number | null
  google_price_per_request: number
  google_monthly_alert: number
}

export type Lead = {
  id: string
  google_place_id: string | null
  name: string
  phone: string | null
  phone_is_mobile: boolean
  city: string | null
  category: string | null
  source: 'google' | 'manual'
  stage: Stage
  next_contact_at: string | null
  lost_reason: string | null
  contacted_at: string | null
  created_at: string
  updated_at: string
}

export type LeadEvent = {
  id: string
  lead_id: string
  type: 'note' | 'stage_change' | 'whatsapp'
  body: string | null
  created_at: string
}

export type MessageTemplate = { id: string; kind: TemplateKind; name: string; body: string }

export type Client = {
  id: string
  lead_id: string | null
  company: string
  contact_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  site_url: string | null
  setup_total: number
  setup_installments: number
  monthly_fee: number
  due_day: number | null
  start_date: string | null
  status: 'active' | 'canceled'
  canceled_at: string | null
  notes: string | null
  created_at: string
}

export type Charge = {
  id: string
  client_id: string
  type: 'setup' | 'monthly'
  competence: string | null
  description: string
  amount: number
  due_date: string
  paid_at: string | null
  method: string
  notes: string | null
  created_at: string
}
