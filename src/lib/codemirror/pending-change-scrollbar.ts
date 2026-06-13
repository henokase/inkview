import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { computeDiff } from '../../stores/pending-changes-store'

export interface ChangeLineRange {
  startLine: number
  endLine: number
  type: 'insert' | 'delete' | 'change'
}

export function getChangeLineRanges(original: string, modified: string): ChangeLineRange[] {
  const diff = computeDiff(original, modified)
  const maxLine = Math.max(1, modified.split('\n').length)
  let modLine = 1
  const changedLines: { line: number; type: 'insert' | 'delete' }[] = []

  for (const entry of diff) {
    if (entry.type === 'equal') {
      modLine++
    } else if (entry.type === 'insert') {
      changedLines.push({ line: modLine, type: 'insert' })
      modLine++
    } else {
      changedLines.push({ line: Math.min(modLine, maxLine), type: 'delete' })
    }
  }

  if (changedLines.length === 0) return []

  const ranges: ChangeLineRange[] = []
  let i = 0
  while (i < changedLines.length) {
    let start = changedLines[i].line
    let end = start
    let type: ChangeLineRange['type'] = changedLines[i].type
    i++

    while (i < changedLines.length && changedLines[i].line <= end + 1) {
      const next = changedLines[i]
      if (next.type !== type) type = 'change'
      end = next.line
      i++
    }

    ranges.push({ startLine: start, endLine: end, type })
  }

  return ranges
}

export function pendingChangeScrollbarMarkers(getOriginalContent: () => string) {
  return ViewPlugin.fromClass(
    class PendingChangeScrollbarPlugin {
      private overlay: HTMLDivElement
      private view: EditorView

      constructor(view: EditorView) {
        this.view = view
        this.overlay = document.createElement('div')
        this.overlay.className = 'cm-pending-change-scrollbar'
        this.view.dom.appendChild(this.overlay)
        this.render()
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.geometryChanged) {
          this.render()
        }
      }

      private render() {
        const { view } = this
        const modified = view.state.doc.toString()
        const ranges = getChangeLineRanges(getOriginalContent(), modified)

        this.overlay.replaceChildren()
        if (ranges.length === 0) return

        const contentHeight = view.contentHeight
        if (contentHeight <= 0) return

        for (const range of ranges) {
          const startLine = view.state.doc.line(Math.min(range.startLine, view.state.doc.lines))
          const endLine = view.state.doc.line(Math.min(range.endLine, view.state.doc.lines))
          const topBlock = view.lineBlockAt(startLine.from)
          const endPos = endLine.to > endLine.from ? endLine.to - 1 : endLine.from
          const bottomBlock = view.lineBlockAt(endPos)

          const topPct = (topBlock.top / contentHeight) * 100
          const heightPct = Math.max(((bottomBlock.bottom - topBlock.top) / contentHeight) * 100, 0.35)

          const marker = document.createElement('div')
          marker.className = `cm-pending-change-scrollbar-marker cm-pending-change-scrollbar-marker-${range.type}`
          marker.style.top = `${topPct}%`
          marker.style.height = `${heightPct}%`
          marker.title =
            range.type === 'insert'
              ? `Addition near line ${range.startLine}`
              : range.type === 'delete'
                ? `Deletion near line ${range.startLine}`
                : `Change near line ${range.startLine}`
          marker.addEventListener('mousedown', (e) => {
            e.preventDefault()
            view.dispatch({
              effects: EditorView.scrollIntoView(startLine.from, { y: 'center' }),
            })
            view.focus()
          })
          this.overlay.appendChild(marker)
        }
      }

      destroy() {
        this.overlay.remove()
      }
    },
  )
}
