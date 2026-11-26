export type SiteStatus = 'none' | 'social' | 'has_site'

const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'linktr.ee',
  'wa.me',
  'whatsapp.com',
  'linkedin.com',
  'tiktok.com',
  'ifood.com.br',
  'sites.google.com',
  'business.site',
]

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

/** Classifica o `websiteUri` do Google: sem site, só rede social/agregador, ou site próprio. */
export function classifySite(uri?: string | null): SiteStatus {
  if (!uri || !uri.trim()) return 'none'
  let url: URL
  try {
    url = new URL(uri.trim())
  } catch {
    return 'has_site'
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  if (SOCIAL_DOMAINS.some((d) => matchesDomain(host, d))) return 'social'
  if (host === 'goo.gl' && url.pathname.startsWith('/maps')) return 'social'
  return 'has_site'
}
