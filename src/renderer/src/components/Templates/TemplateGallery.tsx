import { useState } from 'react'
import { TEMPLATES, CATEGORIES, type Template } from '../../utils/templates'
import { useAppStore } from '../../store/appStore'
import { toast } from '../../utils/toast'

export function TemplateGallery() {
  const [category, setCategory] = useState('all')
  const [preview, setPreview] = useState<Template | null>(null)
  const { openTab } = useAppStore()

  const filtered = category === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === category)

  const handleOpen = (template: Template) => {
    template.files.forEach(file => {
      openTab(`__template__/${file.name}`, file.name, file.content)
    })
    toast.success(`Opened "${template.name}" — edit in the Code tab, preview it in Live Preview!`)
    setPreview(null)
  }

  const DIFF_COLOR: Record<string, string> = {
    beginner: 'var(--accent-green)',
    intermediate: 'var(--accent-yellow)',
    advanced: 'var(--accent-red)'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>🚀 Template Gallery</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Start with a working template — click to open in editor
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 px-4 pb-3 flex-shrink-0 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: category === cat.id ? 'var(--accent-blue)' : 'var(--bg-surface0)',
              color: category === cat.id ? 'var(--bg-base)' : 'var(--text-muted)'
            }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(template => (
            <div key={template.id}
              className="rounded-xl overflow-hidden cursor-pointer transition-all group"
              style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)' }}
              onClick={() => setPreview(template)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}>

              {/* Preview area */}
              <div className="flex items-center justify-center h-20 text-5xl"
                style={{ background: 'var(--bg-mantle)' }}>
                {template.icon}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{template.name}</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: DIFF_COLOR[template.difficulty] + '22', color: DIFF_COLOR[template.difficulty] }}>
                    {template.difficulty}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setPreview(null)}>
          <div className="rounded-2xl shadow-2xl overflow-hidden w-full max-w-md"
            style={{ background: 'var(--bg-surface0)', border: '1px solid var(--border)', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-3xl">{preview.icon}</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{preview.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{preview.description}</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)' }}>
                  {preview.language.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ background: DIFF_COLOR[preview.difficulty] + '22', color: DIFF_COLOR[preview.difficulty] }}>
                  {preview.difficulty}
                </span>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--bg-surface1)', color: 'var(--text-muted)' }}>
                  {preview.files.length} file{preview.files.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {preview.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--bg-surface1)', color: 'var(--text-subtle)' }}>#{tag}</span>
                ))}
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                This will open the template in the editor. For HTML templates, click ▶ in the toolbar to see it in Live Preview!
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPreview(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--bg-surface1)', color: 'var(--text)' }}>
                  Cancel
                </button>
                <button onClick={() => handleOpen(preview)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'var(--accent-blue)', color: 'var(--bg-base)' }}>
                  Open Template →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
