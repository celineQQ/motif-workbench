import { t } from '../data/language'
import { ArrowRight, Check, FileText, Images, ListChecks, PenLine } from 'lucide-react'

export type WorkflowStage = 'plan' | 'draft' | 'media'

export function WorkflowSteps({ stage, approved }: { stage?: WorkflowStage; approved?: boolean }) {
  if (!stage) return null
  const current = stage === 'plan' ? 0 : stage === 'draft' ? 1 : 2
  const steps = [{ id: 'plan', label: t("预案"), icon: ListChecks }, { id: 'draft', label: t("文稿"), icon: FileText }, { id: 'media', label: t("图片与视频"), icon: Images }]
  return <ol className="agent-workflow-steps" aria-label={t("项目创作进度")}>{steps.map((step, index) => {
    const Icon = step.icon
    const done = index < current || (index === current && approved)
    return <li key={step.id} className={`${index === current ? 'active' : ''} ${done ? 'done' : ''}`}><span>{done ? <Check size={12} /> : <Icon size={12} />}</span><b>{step.label}</b>{index < steps.length - 1 && <ArrowRight size={11} />}</li>
  })}</ol>
}

export function StageActions({ stage, busy, onApprove, onRevise }: { stage: 'plan' | 'draft'; busy: boolean; onApprove: () => void; onRevise: () => void }) {
  return <div className="agent-stage-actions"><button className="stage-approve" onClick={onApprove} disabled={busy}><Check size={14} />{stage === 'plan' ? t("确认预案，生成文稿") : t("确认文稿，寻找图片与视频")}<ArrowRight size={13} /></button><button onClick={onRevise} disabled={busy}><PenLine size={13} />{stage === 'plan' ? t("修改预案") : t("修改文稿")}</button></div>
}
