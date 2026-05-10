// ============================================
// WEEKLY GOALS API
// ============================================
//
// In dev / preview we run against a localStorage-backed mock so the UI is
// playable without booting the worker. Set VITE_MOCK_GOALS=0 (or unset) to
// hit the real backend; defaults to mocked in development.

import { get, post, put, del } from './client'
import type {
  WeeklyGoal,
  WeeklyGoalCreate,
  WeeklyGoalsResponse,
} from '@/todo/goals'
import { mondayOf } from '@/todo/goals'


const USE_MOCK = (import.meta.env.VITE_MOCK_GOALS ?? (import.meta.env.DEV ? '1' : '0')) === '1'

// ============================================
// REAL API
// ============================================

const realApi = {
  list: (week?: string) =>
    get<WeeklyGoalsResponse>(`/weekly-goals${week ? `?week=${week}` : ''}`),
  create: (data: WeeklyGoalCreate) =>
    post<WeeklyGoalCreate, WeeklyGoal>('/weekly-goals', data),
  update: (id: string, data: WeeklyGoal) =>
    put<WeeklyGoal, WeeklyGoal>(`/weekly-goals/${id}`, data),
  delete: (id: string) => del<void>(`/weekly-goals/${id}`),
}

// ============================================
// MOCK API (localStorage)
// ============================================

const STORAGE_KEY = 'focus.mock.weeklyGoals.v2'
const SEEDED_KEY = 'focus.mock.weeklyGoals.seeded.v2'

const readStore = (): WeeklyGoal[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as WeeklyGoal[]
  } catch {
    return []
  }
}

const writeStore = (goals: WeeklyGoal[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
}

const nowIso = () => new Date().toISOString()

const computeCompletedAt = (target: number, progress: number, prev: string | null) => {
  if (target > 0 && progress >= target) return prev ?? nowIso()
  return null
}

const seedIfEmpty = () => {
  if (localStorage.getItem(SEEDED_KEY)) return
  const week = mondayOf(new Date())
  const seed: WeeklyGoal[] = [
    {
      id: crypto.randomUUID(),
      weekStart: week,
      title: 'Go to gym',
      target: 3,
      progress: 2,
      recurring: true,
      order: 0,
      createdAt: nowIso(),
      completedAt: null,
    },
    {
      id: crypto.randomUUID(),
      weekStart: week,
      title: 'Shave',
      target: 1,
      progress: 1,
      recurring: false,
      order: 1,
      createdAt: nowIso(),
      completedAt: nowIso(),
    },
    {
      id: crypto.randomUUID(),
      weekStart: week,
      title: 'Cleanup emails',
      target: 1,
      progress: 0,
      recurring: true,
      order: 2,
      createdAt: nowIso(),
      completedAt: null,
    },
    {
      id: crypto.randomUUID(),
      weekStart: week,
      title: 'Read 30 min daily',
      target: 7,
      progress: 4,
      recurring: true,
      order: 3,
      createdAt: nowIso(),
      completedAt: null,
    },
    {
      id: crypto.randomUUID(),
      weekStart: week,
      title: 'Call mom',
      target: 1,
      progress: 1,
      recurring: true,
      order: 4,
      createdAt: nowIso(),
      completedAt: nowIso(),
    },
  ]
  writeStore(seed)
  localStorage.setItem(SEEDED_KEY, '1')
}

const mockApi = {
  list: async (week?: string): Promise<WeeklyGoalsResponse> => {
    seedIfEmpty()
    const weekStart = week ?? mondayOf(new Date())
    const goals = readStore()
      .filter(g => g.weekStart === weekStart)
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    return { weekStart, goals }
  },
  create: async (data: WeeklyGoalCreate): Promise<WeeklyGoal> => {
    const goal: WeeklyGoal = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      completedAt: computeCompletedAt(data.target, data.progress, null),
    }
    writeStore([...readStore(), goal])
    return goal
  },
  update: async (id: string, data: WeeklyGoal): Promise<WeeklyGoal> => {
    const goals = readStore()
    const prev = goals.find(g => g.id === id)
    const target = Math.max(1, data.target)
    const progress = Math.max(0, Math.min(target, data.progress))
    const updated: WeeklyGoal = {
      ...data,
      target,
      progress,
      completedAt: computeCompletedAt(target, progress, prev?.completedAt ?? null),
    }
    writeStore(goals.map(g => (g.id === id ? updated : g)))
    return updated
  },
  delete: async (id: string): Promise<void> => {
    writeStore(readStore().filter(g => g.id !== id))
  },
}

// ============================================
// EXPORTED API
// ============================================

export const weeklyGoalsApi = USE_MOCK ? mockApi : realApi
export const weeklyGoalsMockMode = USE_MOCK
