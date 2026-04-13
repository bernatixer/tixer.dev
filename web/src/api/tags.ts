import { get, post, del } from './client'
import type { TagConfig } from '@/todo/types'

export interface CreateTagRequest {
  name: string
  color: string
}

export const tagsApi = {
  list: () => get<TagConfig[]>('/tags'),
  create: (data: CreateTagRequest) => post<CreateTagRequest, TagConfig>('/tags', data),
  delete: (id: string) => del<void>(`/tags/${id}`),
} as const
