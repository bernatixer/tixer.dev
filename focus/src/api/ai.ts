// ============================================
// AI (proxied through backend)
// ============================================

import { post } from './client'

export const isAiEnabled = (): boolean => true

// ============================================
// DAILY STANDUP
// ============================================

interface StandupRequest {
  dateLabel: string
  taskTitles: string[]
}

interface StandupResponse {
  message: string
}

export const composeStandup = async (
  dateLabel: string,
  taskTitles: string[]
): Promise<string> => {
  const resp = await post<StandupRequest, StandupResponse>('/ai/daily-standup', {
    dateLabel,
    taskTitles,
  })
  return resp.message?.trim() || ''
}

