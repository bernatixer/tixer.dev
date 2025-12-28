// ============================================
// MOCK DATA
// ============================================

import type { Task } from './types'

// Helper to create dates relative to today
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

function daysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(0, 0, 0, 0)
  return date
}

export function getMockTasks(): Task[] {
  return [
    // INBOX
    {
      id: 'task-1',
      title: 'Look into new project management tools',
      priority: 'medium',
      columnId: 'inbox',
      tags: ['ideas'],
      dueDate: null,
      createdAt: daysAgo(6),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-2',
      title: 'Check out that restaurant recommendation',
      priority: 'low',
      columnId: 'inbox',
      tags: ['personal'],
      dueDate: null,
      createdAt: daysAgo(10),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-3',
      title: 'Research weekend hiking trails',
      priority: 'low',
      columnId: 'inbox',
      tags: ['personal'],
      dueDate: null,
      createdAt: daysAgo(16),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-4',
      title: 'Compare credit card options',
      priority: 'medium',
      columnId: 'inbox',
      tags: ['finance'],
      dueDate: null,
      createdAt: daysAgo(23),
      recurrence: null,
      subtasks: [],
    },

    // TO DO
    {
      id: 'task-5',
      title: 'Return Amazon package before deadline',
      priority: 'urgent',
      columnId: 'todo',
      tags: ['shopping'],
      dueDate: daysFromNow(0), // Today
      createdAt: daysAgo(1),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-6',
      title: 'Review PR #247 - API refactoring',
      priority: 'high',
      columnId: 'todo',
      tags: ['work'],
      dueDate: daysFromNow(1), // Tomorrow
      createdAt: daysAgo(1),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-7',
      title: 'Prepare slides for Monday standup',
      priority: 'high',
      columnId: 'todo',
      tags: ['work'],
      dueDate: daysFromNow(2),
      createdAt: daysAgo(2),
      recurrence: null,
      subtasks: [
        { id: 'st-7-1', text: 'Gather metrics from last week', completed: true },
        { id: 'st-7-2', text: 'Draft key accomplishments', completed: true },
        { id: 'st-7-3', text: 'Add blockers section', completed: true },
      ],
    },
    {
      id: 'task-8',
      title: 'Buy groceries for the week',
      priority: 'medium',
      columnId: 'todo',
      tags: ['shopping'],
      dueDate: daysFromNow(1),
      createdAt: daysAgo(7),
      recurrence: null,
      subtasks: [
        { id: 'st-8-1', text: 'Milk and eggs', completed: true },
        { id: 'st-8-2', text: 'Bread', completed: true },
        { id: 'st-8-3', text: 'Fresh vegetables', completed: false },
        { id: 'st-8-4', text: 'Chicken breast', completed: false },
        { id: 'st-8-5', text: 'Pasta and sauce', completed: false },
        { id: 'st-8-6', text: 'Coffee beans', completed: false },
      ],
    },
    {
      id: 'task-9',
      title: 'Pay rent',
      priority: 'medium',
      columnId: 'todo',
      tags: ['finance'],
      dueDate: daysFromNow(3),
      createdAt: daysAgo(2),
      recurrence: 'monthly',
      subtasks: [],
    },
    {
      id: 'task-10',
      title: 'Book dentist appointment',
      priority: 'medium',
      columnId: 'todo',
      tags: ['health'],
      dueDate: daysAgo(8), // Overdue
      createdAt: daysAgo(14),
      recurrence: null,
      subtasks: [],
    },

    // DOING
    {
      id: 'task-11',
      title: 'Write documentation for new API endpoints',
      priority: 'high',
      columnId: 'doing',
      tags: ['work'],
      dueDate: null,
      createdAt: daysAgo(3),
      recurrence: null,
      subtasks: [
        { id: 'st-11-1', text: 'Document /users endpoints', completed: true },
        { id: 'st-11-2', text: 'Document /auth endpoints', completed: false },
        { id: 'st-11-3', text: 'Add request/response examples', completed: false },
        { id: 'st-11-4', text: 'Update OpenAPI spec', completed: false },
      ],
    },
    {
      id: 'task-12',
      title: 'Plan weekend trip to the mountains',
      priority: 'medium',
      columnId: 'doing',
      tags: ['personal'],
      dueDate: daysFromNow(1),
      createdAt: daysAgo(4),
      recurrence: null,
      subtasks: [
        { id: 'st-12-1', text: 'Choose hiking trail', completed: true },
        { id: 'st-12-2', text: 'Check weather forecast', completed: true },
        { id: 'st-12-3', text: 'Book cabin', completed: true },
        { id: 'st-12-4', text: 'Pack hiking gear', completed: false },
        { id: 'st-12-5', text: 'Buy snacks for the trip', completed: false },
      ],
    },

    // DONE
    {
      id: 'task-13',
      title: 'Deploy v2.3.0 to production',
      priority: 'high',
      columnId: 'done',
      tags: ['work'],
      dueDate: null,
      createdAt: daysAgo(5),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-14',
      title: 'Update team on Q4 roadmap',
      priority: 'medium',
      columnId: 'done',
      tags: ['work'],
      dueDate: null,
      createdAt: daysAgo(7),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-15',
      title: 'Fix critical bug in auth flow',
      priority: 'urgent',
      columnId: 'done',
      tags: ['work'],
      dueDate: null,
      createdAt: daysAgo(3),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-16',
      title: 'Order new running shoes',
      priority: 'low',
      columnId: 'done',
      tags: ['shopping'],
      dueDate: null,
      createdAt: daysAgo(10),
      recurrence: null,
      subtasks: [],
    },
    {
      id: 'task-17',
      title: 'Schedule annual checkup',
      priority: 'medium',
      columnId: 'done',
      tags: ['health'],
      dueDate: null,
      createdAt: daysAgo(14),
      recurrence: 'yearly',
      subtasks: [],
    },
    {
      id: 'task-18',
      title: 'Cancel unused subscription',
      priority: 'low',
      columnId: 'done',
      tags: ['finance'],
      dueDate: null,
      createdAt: daysAgo(20),
      recurrence: null,
      subtasks: [],
    },
  ]
}

