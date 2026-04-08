import { FC, useState, useRef, useEffect, MouseEvent } from 'react'
import type { TagConfig, TagId } from '@/todo/types'
import { useCreateTag } from '@/hooks/useTags'

const TAG_COLOR_PRESETS = ['#4ECDC4', '#FF8A65', '#FFD166', '#5C7CFA', '#F06292', '#81C784'] as const

interface TagEditorProps {
  tags: TagId[]
  availableTags: TagConfig[]
  onChange: (newTags: TagId[]) => void
}

export const TagEditor: FC<TagEditorProps> = ({ tags, availableTags, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState<string>(TAG_COLOR_PRESETS[0])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { mutate: createTag, isPending } = useCreateTag()

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen])

  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsOpen(prev => !prev)
  }

  const handleToggleTag = (tagId: TagId, e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const newTags = tags.includes(tagId)
      ? tags.filter(t => t !== tagId)
      : [...tags, tagId]
    onChange(newTags)
  }

  const handleCreateTag = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()

    const name = newTagName.trim()
    if (!name || isPending) return

    createTag(
      { name, color: selectedColor },
      {
        onSuccess: (tag) => {
          onChange(tags.includes(tag.id) ? tags : [...tags, tag.id])
          setNewTagName('')
        },
      }
    )
  }

  return (
    <div className="tag-editor-wrapper">
      <button
        ref={buttonRef}
        className="tag-editor-trigger"
        onClick={handleToggle}
        title="Edit tags"
      >
        {tags.length > 0 ? (
          <div className="tag-editor-dots">
            {tags.map(tagId => {
              const tag = availableTags.find(item => item.id === tagId)
              return (
                <span
                  key={tagId}
                  className="tag-dot"
                  style={{ backgroundColor: tag?.color ?? 'rgba(255,255,255,0.3)' }}
                />
              )
            })}
          </div>
        ) : (
          <span className="tag-editor-empty">+</span>
        )}
      </button>
      {isOpen && (
        <div ref={dropdownRef} className="tag-editor-dropdown">
          <div className="tag-editor-label">Tags</div>
          {availableTags.map((tag) => {
            const isActive = tags.includes(tag.id)
            return (
              <button
                key={tag.id}
                className={`tag-editor-item ${isActive ? 'active' : ''}`}
                onClick={(e) => handleToggleTag(tag.id, e)}
              >
                <span
                  className="tag-editor-color"
                  style={{ background: isActive ? tag.color : 'rgba(255,255,255,0.1)' }}
                />
                <span style={{ color: isActive ? tag.color : undefined }}>{tag.name}</span>
                {isActive && <span className="tag-editor-check">&#10003;</span>}
              </button>
            )
          })}
          <div className="tag-editor-create">
            <input
              className="tag-editor-input"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onClick={e => e.stopPropagation()}
              placeholder="New tag"
            />
            <div className="tag-editor-swatches">
              {TAG_COLOR_PRESETS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`tag-editor-swatch ${selectedColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setSelectedColor(color)
                  }}
                  title={`Pick ${color}`}
                />
              ))}
            </div>
            <button className="tag-editor-create-btn" onClick={handleCreateTag} disabled={!newTagName.trim() || isPending}>
              {isPending ? 'Creating...' : 'Create tag'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
