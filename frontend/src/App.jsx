import { useState, useRef, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import MessageBubble from './components/MessageBubble'
import ChatInput from './components/ChatInput'
import KnowledgeBaseModal from './components/KnowledgeBaseModal'
import FileUploadModal from './components/FileUploadModal'
import DocumentPanel from './components/DocumentPanel'
import SettingsModal from './components/SettingsModal'
import GlobalSettingsModal from './components/GlobalSettingsModal'

const API_BASE = 'http://localhost:8000'

export default function App() {
  const [kbs, setKbs] = useState([])
  const [selectedKb, setSelectedKb] = useState(null)
  const [managingKb, setManagingKb] = useState(null)
  const [settingsKb, setSettingsKb] = useState(null)
  const [showGlobalSettings, setShowGlobalSettings] = useState(false)
  const [showKbModal, setShowKbModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const lastQuestionRef = useRef('')
  const eventSourceRef = useRef(null)
  const bottomRef = useRef(null)

  const fetchKbs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/knowledge`)
      if (res.ok) {
        const data = await res.json()
        setKbs(data)
        if (data.length > 0 && !selectedKb) {
          setSelectedKb(data[0].id)
        }
      }
    } catch {}
  }, [selectedKb])

  useEffect(() => {
    fetchKbs()
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`)
      const data = await res.json()
      setSessions(data)
      if (data.length > 0 && !selectedSession) {
        setSelectedSession(data[0].id)
      }
    } catch {}
  }

  const fetchMessages = useCallback(async (sessionId) => {
    if (!sessionId) return
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages`)
      const data = await res.json()
      setMessages(data)
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession)
    } else {
      setMessages([])
    }
  }, [selectedSession, fetchMessages])

  const sendMessage = useCallback(async (question) => {
    if (!question.trim() || loading) return
    lastQuestionRef.current = question

    let sessionId = selectedSession
    if (!sessionId) {
      try {
        const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' })
        const data = await res.json()
        sessionId = data.id
        setSelectedSession(sessionId)
        setSessions(prev => [data, ...prev])
      } catch {
        return
      }
    }

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    const kbParam = selectedKb ? `&kb_id=${selectedKb}` : ''

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const es = new EventSource(`${API_BASE}/chat/stream?question=${encodeURIComponent(question)}&session_id=${sessionId}${kbParam}`)
    eventSourceRef.current = es

    es.addEventListener('token', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'token') {
          setMessages(prev => {
            const next = [...prev]
            const last = { ...next[next.length - 1], content: next[next.length - 1].content + data.content }
            next[next.length - 1] = last
            return next
          })
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('done', () => {
      es.close()
      eventSourceRef.current = null
      setLoading(false)
    })

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setLoading(false)
    }
  }, [loading, selectedSession, selectedKb])

  const handleRegenerate = useCallback(() => {
    if (!lastQuestionRef.current || loading) return
    setMessages(prev => {
      const next = [...prev]
      next.pop()
      return next
    })
    sendMessage(lastQuestionRef.current)
  }, [loading, sendMessage])

  const clearChat = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setMessages([])
    setLoading(false)
  }

  const handleNewSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' })
      const data = await res.json()
      setSessions(prev => [data, ...prev])
      setSelectedSession(data.id)
      setMessages([])
    } catch {}
  }

  const handleSelectSession = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setSelectedSession(id)
    setLoading(false)
  }

  const handleRenameSession = async (sessionId, newName) => {
    try {
      const res = await fetch(`${API_BASE}/sessions?name=${encodeURIComponent(newName)}&session_id=${sessionId}`, {
        method: 'PUT',
      })
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: newName } : s))
      }
    } catch {}
  }

  const handleCreateKb = async ({ name, description, chunk_size, chunk_overlap }) => {
    const params = new URLSearchParams({ name, description })
    if (chunk_size !== undefined) params.set('chunk_size', chunk_size)
    if (chunk_overlap !== undefined) params.set('chunk_overlap', chunk_overlap)
    const res = await fetch(`${API_BASE}/knowledge?${params}`, { method: 'POST' })
    if (!res.ok) throw new Error('创建失败')
    await fetchKbs()
  }

  const handleSaveSettings = async (kbId, params) => {
    const query = new URLSearchParams()
    if (params.chunk_size !== undefined) query.set('chunk_size', params.chunk_size)
    if (params.chunk_overlap !== undefined) query.set('chunk_overlap', params.chunk_overlap)
    const res = await fetch(`${API_BASE}/knowledge/${kbId}?${query}`, { method: 'PATCH' })
    if (!res.ok) throw new Error('保存失败')
    await fetchKbs()
  }

  const handleSaveGlobalSettings = async (data) => {
    const res = await fetch(`${API_BASE}/config/ai`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('保存失败')
  }

  const handleDeleteKb = async (kbId, kbName) => {
    if (!confirm(`确定删除知识库 "${kbName}"？\n该操作将删除所有文档和向量数据，不可恢复。`)) return
    try {
      await fetch(`${API_BASE}/knowledge/${kbId}`, { method: 'DELETE' })
      if (selectedKb === kbId) setSelectedKb(null)
      if (managingKb === kbId) setManagingKb(null)
      await fetchKbs()
    } catch {}
  }

  const handleSelectKb = (kbId) => {
    setSelectedKb(kbId)
    setManagingKb(null)
  }

  const handleManageKb = (kbId) => {
    setManagingKb(kbId)
  }

  const getKbName = (kbId) => kbs.find(kb => kb.id === kbId)?.name || ''

  // Show document panel when managing a KB
  if (managingKb) {
    return (
      <div className="flex h-dvh bg-gray-100">
        <Sidebar
          knowledgeBases={kbs}
          selectedKb={selectedKb}
          onSelectKb={handleSelectKb}
          onManageKb={handleManageKb}
          onDeleteKb={handleDeleteKb}
          onSettingsKb={setSettingsKb}
          sessions={sessions}
          selectedSession={selectedSession}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onNewKb={() => setShowKbModal(true)}
          onRenameSession={handleRenameSession}
        />
        <DocumentPanel
          kbId={managingKb}
          kbName={getKbName(managingKb)}
          onBack={() => setManagingKb(null)}
        />
        {showKbModal && (
          <KnowledgeBaseModal
            onClose={() => setShowKbModal(false)}
            onSubmit={handleCreateKb}
          />
        )}
        {settingsKb && (
          <SettingsModal
            kb={settingsKb}
            onClose={() => setSettingsKb(null)}
            onSave={handleSaveSettings}
          />
        )}
        {showGlobalSettings && (
          <GlobalSettingsModal
            onClose={() => setShowGlobalSettings(false)}
            onSave={handleSaveGlobalSettings}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-dvh bg-gray-100">
      <Sidebar
        knowledgeBases={kbs}
        selectedKb={selectedKb}
        onSelectKb={handleSelectKb}
        onManageKb={handleManageKb}
        onDeleteKb={handleDeleteKb}
        onSettingsKb={setSettingsKb}
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onNewKb={() => setShowKbModal(true)}
        onRenameSession={handleRenameSession}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-800">RAG 知识库问答系统</h1>
            {selectedKb && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {getKbName(selectedKb)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGlobalSettings(true)}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              title="全局设置"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="text-sm text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
              title="上传文件到知识库"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <button
              onClick={clearChat}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              title="清空当前对话"
            >
              🗑
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-5xl mb-4">💬</div>
              <p className="text-sm">选择知识库，输入问题开始对话</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              message={msg}
              onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          loading={loading}
        />
      </div>

      {showKbModal && (
        <KnowledgeBaseModal
          onClose={() => setShowKbModal(false)}
          onSubmit={handleCreateKb}
        />
      )}
      {showUploadModal && (
        <FileUploadModal
          knowledgeBases={kbs}
          onClose={() => setShowUploadModal(false)}
          onSuccess={fetchKbs}
        />
      )}
      {settingsKb && (
        <SettingsModal
          kb={settingsKb}
          onClose={() => setSettingsKb(null)}
          onSave={handleSaveSettings}
        />
      )}
      {showGlobalSettings && (
        <GlobalSettingsModal
          onClose={() => setShowGlobalSettings(false)}
          onSave={handleSaveGlobalSettings}
        />
      )}
    </div>
  )
}
