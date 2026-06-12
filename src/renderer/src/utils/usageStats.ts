/**
 * usageStats.ts — local-only usage tracking for the welcome-screen overview
 * (Claude-Desktop-style stats). Nothing leaves the device; stored in
 * localStorage under 'momiji:usage-stats'.
 */

interface StatsData {
  sessions: number
  aiMsgs: number
  tokens: number
  models: Record<string, number>
  hours: Record<string, number>
  days: Record<string, number>   // 'YYYY-MM-DD' → activity count
}

const KEY = 'momiji:usage-stats'

function load(): StatsData {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { sessions: 0, aiMsgs: 0, tokens: 0, models: {}, hours: {}, days: {}, ...d }
  } catch {
    return { sessions: 0, aiMsgs: 0, tokens: 0, models: {}, hours: {}, days: {} }
  }
}
function save(d: StatsData) { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {} }
function today(): string { return new Date().toISOString().slice(0, 10) }

let sessionRecorded = false

export function recordAppOpen() {
  if (sessionRecorded) return
  sessionRecorded = true
  const d = load()
  d.sessions++
  d.days[today()] = (d.days[today()] ?? 0) + 1
  save(d)
}

export function recordAiCall(model: string, approxTokens: number) {
  const d = load()
  d.aiMsgs++
  d.tokens += Math.max(0, Math.round(approxTokens))
  d.models[model] = (d.models[model] ?? 0) + 1
  const h = String(new Date().getHours())
  d.hours[h] = (d.hours[h] ?? 0) + 1
  d.days[today()] = (d.days[today()] ?? 0) + 1
  save(d)
}

export interface StatsSummary {
  sessions: number
  aiMsgs: number
  tokens: number
  activeDays: number
  streak: number
  favModel: string | null
  peakHour: string | null
  /** last `weeks`×7 grid of counts, column-major (weeks), oldest first */
  heatmap: number[][]
}

export function getStats(weeks = 12): StatsSummary {
  const d = load()
  const activeDays = Object.keys(d.days).length

  // Current streak: consecutive days ending today (or yesterday)
  let streak = 0
  const dt = new Date()
  if (!d.days[dt.toISOString().slice(0, 10)]) dt.setDate(dt.getDate() - 1)
  while (d.days[dt.toISOString().slice(0, 10)]) { streak++; dt.setDate(dt.getDate() - 1) }

  let favModel: string | null = null, favN = 0
  for (const [m, n] of Object.entries(d.models)) if (n > favN) { favModel = m; favN = n }

  let peakHour: string | null = null, peakN = 0
  for (const [h, n] of Object.entries(d.hours)) if (n > peakN) { peakHour = h; peakN = n }

  // Heatmap grid — end on the current week (Sun-start columns)
  const heatmap: number[][] = []
  const end = new Date()
  end.setDate(end.getDate() + (6 - end.getDay())) // end of this week
  for (let w = weeks - 1; w >= 0; w--) {
    const col: number[] = []
    for (let day = 0; day < 7; day++) {
      const cur = new Date(end)
      cur.setDate(end.getDate() - w * 7 - (6 - day))
      col.push(d.days[cur.toISOString().slice(0, 10)] ?? 0)
    }
    heatmap.push(col)
  }

  return { sessions: d.sessions, aiMsgs: d.aiMsgs, tokens: d.tokens, activeDays, streak, favModel, peakHour: peakHour != null ? `${peakHour}:00` : null, heatmap }
}
