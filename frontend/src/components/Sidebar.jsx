import { useState, useEffect, useRef } from 'react'

export default function Sidebar({
  knowledgeBases,
  selectedKb,
  onSelectKb,
  onManageKb,
  onDeleteKb,
  onSettingsKb,
  sessions,
  selectedSession,
  onSelectSession,
  onNewSession,
  onNewKb,
  onRenameSession,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [ctxMenu, setCtxMenu] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  useEffect(() => {
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const handleDoubleClick = (s) => {
    setEditingId(s.id)
    setEditValue(s.name)
  }

  const handleContextMenu = (e, s) => {
    e.preventDefault()
    setCtxMenu({ id: s.id, x: e.clientX, y: e.clientY })
  }

  const confirmRename = () => {
    if (editingId && editValue.trim()) {
      onRenameSession(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      confirmRename()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditValue('')
    }
  }

  const handleCtxRename = () => {
    if (ctxMenu) {
      const s = sessions.find(s => s.id === ctxMenu.id)
      if (s) {
        setEditingId(s.id)
        setEditValue(s.name)
      }
      setCtxMenu(null)
    }
  }
  return (
    <aside className="w-60 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">知识库</h2>
        <button
          onClick={onNewKb}
          className="text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
          title="新建知识库"
        >
          ＋ 新建
        </button>
      </div>
      <div className="px-2 py-2 space-y-0.5 overflow-y-auto max-h-[40%]">
        {knowledgeBases.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">暂无知识库</p>
        )}
        {knowledgeBases.map(kb => (
          <div
            key={kb.id}
            className={`group flex items-center rounded-lg transition-colors ${
              selectedKb === kb.id ? 'bg-blue-100' : 'hover:bg-gray-200'
            }`}
          >
            <button
              onClick={() => onSelectKb(kb.id)}
              className={`flex-1 text-left px-3 py-2 text-sm cursor-pointer ${
                selectedKb === kb.id ? 'text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              <span className="truncate block">{kb.name}</span>
              <span className="text-xs text-gray-400 font-normal">{kb.doc_count} 文档</span>
            </button>
            <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onSettingsKb(kb)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                title="参数设置"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <button
                onClick={() => onManageKb(kb.id)}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                title="管理文档"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </button>
              <button
                onClick={() => onDeleteKb(kb.id, kb.name)}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                title="删除知识库"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 px-4 py-3 border-t border-gray-200">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">会话列表</h2>
      </div>
      <div className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {sessions.map(s => (
          <div
            key={s.id}
            onDoubleClick={() => handleDoubleClick(s)}
            onContextMenu={(e) => handleContextMenu(e, s)}
            onClick={() => { if (!editingId) onSelectSession(s.id) }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              selectedSession === s.id
                ? 'bg-gray-200 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {editingId === s.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                className="w-full px-1 py-0 text-sm border border-blue-400 rounded outline-none bg-white"
              />
            ) : (
              <span className="truncate block">{s.name}</span>
            )}
          </div>
        ))}
      </div>

      {ctxMenu && (
        <div
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm min-w-[100px]"
        >
          <button
            onClick={handleCtxRename}
            className="w-full text-left px-4 py-1.5 hover:bg-gray-100 whitespace-nowrap cursor-pointer"
          >
            重命名
          </button>
        </div>
      )}

      <div className="px-2 py-3 border-t border-gray-200">
        <button
          onClick={onNewSession}
          className="w-full px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 transition-colors cursor-pointer"
        >
          ＋ 新建会话
        </button>
      </div>
    </aside>
  )
}
