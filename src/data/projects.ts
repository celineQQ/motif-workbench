import { t } from './language'
import { useLocalStorage } from './useLocalStorage'

export type ProjectStage = 'inspiration' | 'collecting' | 'creating' | 'complete'
export type TaskStatus = 'todo' | 'doing' | 'done'

export type Project = {
  id: string
  name: string
  description: string
  stage: ProjectStage
  domains: string[]
  assetIds: string[]
  documentIds: string[]
  conversationIds: string[]
  createdAt: number
  updatedAt: number
}

export type Task = {
  id: number
  label: string
  done: boolean
  status?: TaskStatus
  projectId?: string
  dueDate?: string
  createdAt?: number
}

export const projectStages: { id: ProjectStage; label: string; english: string }[] = [
  { id: 'inspiration', label: t("灵感"), english: 'SPARK' },
  { id: 'collecting', label: t("收集"), english: 'COLLECT' },
  { id: 'creating', label: t("创作"), english: 'CREATE' },
  { id: 'complete', label: t("完成"), english: 'COMPLETE' },
]

export const taskStatusOf = (task: Task): TaskStatus => task.status ?? (task.done ? 'done' : 'todo')

export function useProjects() {
  return useLocalStorage<Project[]>('motif-projects-v1', [])
}
