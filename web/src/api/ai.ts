// ============================================
// AI TASK PARSER (proxied through backend)
// ============================================

import type { Priority, TagConfig } from '@/todo/types'
import { post } from './client'

export const isAiEnabled = (): boolean => true

export interface ParsedTask {
  title: string
  description: string | null
  priority: Priority
  dueDate: string | null
  tags: string[]
}

interface ParseRequest {
  text: string
  availableTags: string[]
}

export const parseTaskFromText = async (
  text: string,
  availableTags: TagConfig[]
): Promise<ParsedTask> => {
  const raw = await post<ParseRequest, Partial<ParsedTask>>('/ai/parse-task', {
    text,
    availableTags: availableTags.map(t => t.name),
  })

  return normalize(raw, text, availableTags)
}

const VALID_PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

const normalize = (
  raw: Partial<ParsedTask>,
  fallbackText: string,
  availableTags: TagConfig[]
): ParsedTask => {
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : fallbackText.trim()

  const description = typeof raw.description === 'string' && raw.description.trim()
    ? raw.description.trim()
    : null

  const priority = VALID_PRIORITIES.includes(raw.priority as Priority)
    ? raw.priority as Priority
    : 'medium'

  let dueDate: string | null = null
  if (typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)) {
    dueDate = raw.dueDate
  }

  const tagNameMap = new Map(availableTags.map(t => [t.name.toLowerCase(), t.name]))
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map(name => typeof name === 'string' ? tagNameMap.get(name.toLowerCase()) : undefined)
        .filter((name): name is string => Boolean(name))
    : []

  return { title, description, priority, dueDate, tags }
}

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

