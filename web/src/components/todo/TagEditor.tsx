// ============================================
// TAG EDITOR DROPDOWN
// ============================================

import { FC, useState, useRef, useEffect, MouseEvent } from 'react'
import type { TagId } from '@/todo/types'
import { TAGS } from '@/todo/types'

interface TagEditorProps {
  tags: TagId[]
  onChange: (newTags: TagId[]) => void
}

export const TagEditor: FC<TagEditorProps> = ({ tags, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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
            {tags.map(tagId => (
              <span key={tagId} className={`tag-dot dot-${tagId}`} />
            ))}
          </div>
        ) : (
          <span className="tag-editor-empty">+</span>
        )}
      </button>
      {isOpen && (
        <div ref={dropdownRef} className="tag-editor-dropdown">
          <div className="tag-editor-label">Tags</div>
          {TAGS.map((tag) => {
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
        </div>
      )}
    </div>
  )
}
