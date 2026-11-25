import { isEnglish } from './language'

export const portfolioDemo = import.meta.env.MODE === 'portfolio'
export const demoModel = 'gpt-4.1-mini'
export const demoPrompt = isEnglish ? 'When our creations feel, how should we respond? Compare Mary Shelley, the two Frankenstein films and Vision. Draft a research plan on care, agency and belonging.' : '当造物有了感情，人类该如何回应？请对照雪莱小说、两版《弗兰肯斯坦》和幻视，整理一份有关照护、拒绝与归属的研究预案。'

const plan = '# 项目预案\n\n1. 对照 1910 年的创造场景与 2025 年版造物自述，记录谁拥有讲述和解释的权力。\n2. 从雪莱小说与幻视素材各选一条证据，标注造物的要求、它能否拒绝，以及旁人的回应。\n3. 写一段比较，再提出一个界面问题：当技术回应情绪时，怎样让使用者保有退出和改写互动的权利？\n\n媒体检索词：Frankenstein 1910'
const draft = '# 当造物有了感情，人类该如何回应？\n\n## 谁在讲述造物的经历\n把 1910 年电影的创造场景和德尔·托罗版（2025）中造物讲述自身遭遇的片段并读。镜头让谁先被看见？当造物自己讲述经历，照护的责任就成了可以追问的问题。\n\n## 当关怀来自一个被设计的角色\n在幻视的漫画与剧集中对照不同形式的归属，追问人类是否愿意给被创造的角色选择、拒绝和求助的空间。\n\n## 转入人机交互叙事\n记录界面如何表现关怀，以及使用者是否主观上感到被听见。观察使用者能否改写、拒绝或结束这场互动。'

const englishPlan = '# Research Plan\n\n1. Compare the 1910 creation scene with the Creature’s perspective in Guillermo del Toro’s 2025 film.\n2. Find one scene in Shelley and one in Vision that show a creation making a choice or refusing a role.\n3. Use the evidence to ask how an interface can acknowledge emotion while leaving people free to revise or end the interaction.\n\nMedia search: Frankenstein 1910'

const englishDraft = '# When Our Creations Feel, How Should We Respond?\n\n## Who gets to tell the story?\nThe 1910 film puts the creation experiment on screen. Del Toro’s 2025 film gives the Creature room to tell its own story. Compare whose needs each moment makes visible.\n\n## Care and agency\nVision’s search for belonging asks whether a being designed for a purpose can refuse it. Compare that choice with what Shelley’s Creature asks of Victor.\n\n## From fiction to interface\nRecord the signals an interface uses to express care and the moments a user actually feels heard. Then ask whether the user can revise, refuse or end the exchange.'

export async function streamPortfolioReply(isPlan: boolean, signal: AbortSignal, onDelta: (text: string) => void) {
  const text = isEnglish ? (isPlan ? englishPlan : englishDraft) : (isPlan ? plan : draft)
  for (const chunk of text.match(/[^]{1,14}/gu) ?? []) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 65))
    signal.throwIfAborted()
    onDelta(chunk)
  }
  return { text, sources: [], searched: false, queries: [] }
}
