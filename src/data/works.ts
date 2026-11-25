import { useLocalStorage } from './useLocalStorage'

export type WorkDocument = {
  id: string
  title: string
  content: string
  tags: string[]
  updatedAt: number
}

export function useWorksDocuments() {
  return useLocalStorage<WorkDocument[]>('motif-work-documents-v2', [])
}
