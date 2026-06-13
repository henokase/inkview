import editDocPromptText from './prompts/edit-doc.txt?raw'
import writeDocPromptText from './prompts/write-doc.txt?raw'
import createDocPromptText from './prompts/create-doc.txt?raw'
import readDocPromptText from './prompts/read-doc.txt?raw'
import searchDocsPromptText from './prompts/search-docs.txt?raw'
import listDocsPromptText from './prompts/list-docs.txt?raw'
import deleteDocPromptText from './prompts/delete-doc.txt?raw'
import webSearchPromptText from './prompts/web-search.txt?raw'
import webFetchPromptText from './prompts/web-fetch.txt?raw'

export const editDocPrompt = editDocPromptText
export const writeDocPrompt = writeDocPromptText
export const createDocPrompt = createDocPromptText
export const readDocPrompt = readDocPromptText
export const searchDocsPrompt = searchDocsPromptText
export const listDocsPrompt = listDocsPromptText
export const deleteDocPrompt = deleteDocPromptText
export const webSearchPrompt = webSearchPromptText
export const webFetchPrompt = webFetchPromptText

export const toolPrompts: Record<string, string> = {
  editDoc: editDocPrompt,
  writeDoc: writeDocPrompt,
  createDoc: createDocPrompt,
  readDoc: readDocPrompt,
  searchDocs: searchDocsPrompt,
  listDocs: listDocsPrompt,
  deleteDoc: deleteDocPrompt,
  webSearch: webSearchPrompt,
  webFetch: webFetchPrompt,
}
