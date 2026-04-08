import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '@/api/tags'

export const tagKeys = {
  all: ['tags'] as const,
  list: () => [...tagKeys.all, 'list'] as const,
} as const

export function useTags(enabled = true) {
  return useQuery({
    queryKey: tagKeys.list(),
    queryFn: () => tagsApi.list(),
    enabled,
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
    },
  })
}
