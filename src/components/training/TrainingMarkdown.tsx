import { ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={i}>{tok.slice(2, -2)}</strong>
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return <em key={i}>{tok.slice(1, -1)}</em>
    }
    return tok
  })
}

type Block =
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h3', text: line.slice(3) })
    } else if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1]
      if (last?.type === 'ul') {
        last.items.push(line.slice(2))
      } else {
        blocks.push({ type: 'ul', items: [line.slice(2)] })
      }
    } else {
      blocks.push({ type: 'p', text: line })
    }
  }
  return blocks
}

/** Renders exercise descriptions: `## ` headings, `- ` lists, **bold**, *italic*. */
export function TrainingMarkdown({ text }: { text: string }) {
  return (
    <>
      {toBlocks(text).map((block, i) => {
        if (block.type === 'h3') {
          return <h3 key={i} className="training-detail__h3">{renderInline(block.text)}</h3>
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="training-detail__ul">
              {block.items.map((item, j) => (
                <li key={j} className="training-detail__li">{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        return <p key={i} className="training-detail__p">{renderInline(block.text)}</p>
      })}
    </>
  )
}
