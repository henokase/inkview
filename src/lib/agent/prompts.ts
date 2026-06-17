import editDocPromptText from '../../prompts/tools/edit-doc.txt?raw'
import writeDocPromptText from '../../prompts/tools/write-doc.txt?raw'
import readDocPromptText from '../../prompts/tools/read-doc.txt?raw'
import searchDocsPromptText from '../../prompts/tools/search-docs.txt?raw'
import listDocsPromptText from '../../prompts/tools/list-docs.txt?raw'
import deleteDocPromptText from '../../prompts/tools/delete-doc.txt?raw'
import webSearchPromptText from '../../prompts/tools/web-search.txt?raw'
import webFetchPromptText from '../../prompts/tools/web-fetch.txt?raw'

export const editDocPrompt = editDocPromptText
export const writeDocPrompt = writeDocPromptText
export const readDocPrompt = readDocPromptText
export const searchDocsPrompt = searchDocsPromptText
export const listDocsPrompt = listDocsPromptText
export const deleteDocPrompt = deleteDocPromptText
export const webSearchPrompt = webSearchPromptText
export const webFetchPrompt = webFetchPromptText

export const toolPrompts: Record<string, string> = {
  editDoc: editDocPrompt,
  writeDoc: writeDocPrompt,
  readDoc: readDocPrompt,
  searchDocs: searchDocsPrompt,
  listDocs: listDocsPrompt,
  deleteDoc: deleteDocPrompt,
  webSearch: webSearchPrompt,
  webFetch: webFetchPrompt,
}
