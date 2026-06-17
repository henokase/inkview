import basePrompt from './system/base.xml?raw'
import agentPrompt from './system/agent.xml?raw'
import chatPrompt from './system/chat.xml?raw'
import {
  readDocPrompt,
  searchDocsPrompt,
  listDocsPrompt,
  webSearchPrompt,
  webFetchPrompt,
  editDocPrompt,
  writeDocPrompt,
  deleteDocPrompt,
} from '../lib/agent/prompts'

export type Mode = 'agent' | 'chat'

const CHAT_TOOLS = new Set(['readDoc', 'searchDocs', 'listDocs', 'webSearch', 'webFetch'])
const AGENT_TOOLS = new Set(['readDoc', 'searchDocs', 'listDocs', 'webSearch', 'webFetch', 'editDoc', 'writeDoc', 'deleteDoc'])

const toolPromptMap: Record<string, string> = {
  readDoc: readDocPrompt,
  searchDocs: searchDocsPrompt,
  listDocs: listDocsPrompt,
  webSearch: webSearchPrompt,
  webFetch: webFetchPrompt,
  editDoc: editDocPrompt,
  writeDoc: writeDocPrompt,
  deleteDoc: deleteDocPrompt,
}

export function getToolPrompts(mode: Mode): string[] {
  const allowed = mode === 'agent' ? AGENT_TOOLS : CHAT_TOOLS
  return Array.from(allowed)
    .map((name) => toolPromptMap[name])
    .filter(Boolean)
}

export function buildSystemPrompt(mode: Mode, activeDoc?: { title: string; id: string }): string {
  const toolGuides = getToolPrompts(mode).join('\n\n')
  const base = basePrompt.trim()

  const activeDocInfo = activeDoc
    ? `Active document: "${activeDoc.title}" (ID: ${activeDoc.id})`
    : 'No document is currently open.'

  const baseWithDoc = base.replace(/\{activeDocInfo\}/g, activeDocInfo)
  const modeContent = (mode === 'agent' ? agentPrompt : chatPrompt).trim()
  return `${baseWithDoc}\n\n${modeContent}\n\n<toolGuidelines>\n${toolGuides}\n</toolGuidelines>`
}
