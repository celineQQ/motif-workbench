import type { LibraryAsset } from '../data/library'
import type { WorkDocument } from '../data/works'
import type { Project } from '../data/projects'
import { KnowledgeAtlas } from './KnowledgeAtlas'

export function ProjectNetwork({ assets, documents, projects, onOpenProject }: { assets: LibraryAsset[]; documents: WorkDocument[]; projects: Project[]; onOpenProject: (projectId?: string) => void }) {
  return <KnowledgeAtlas assets={assets} documents={documents} projects={projects} onOpenProject={onOpenProject} />
}
