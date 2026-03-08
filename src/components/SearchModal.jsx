import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDate, parseNoteContent, getItemsCached } from '../hooks/useNotes'
import { Search, X, Folder, FileText } from 'lucide-react'

function highlightMatch(text, query) {
    if (!text || !query) return text
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
        regex.test(part)
            ? <span key={i} className="text-blue-500 font-bold">{part}</span>
            : part
    )
}

export default function SearchModal({ isOpen, onClose }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const inputRef = useRef(null)
    const navigate = useNavigate()
    const cachedItemsRef = useRef([])
    const debounceRef = useRef(null)

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setResults([])
            // Cache items once on open (avoids JSON.parse per keystroke)
            cachedItemsRef.current = getItemsCached().filter(i => !i.isTrashed)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
        return () => clearTimeout(debounceRef.current)
    }, [isOpen])

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); isOpen ? onClose() : null }
            if (e.key === 'Escape' && isOpen) onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    function performSearch(q) {
        const trimmed = q.toLowerCase().trim()
        if (!trimmed) { setResults([]); return }

        const matches = cachedItemsRef.current.filter(item => {
            if (item.type === 'folder') return item.name.toLowerCase().includes(trimmed)
            const text = item.content.replace(/<[^>]*>?/gm, ' ').toLowerCase()
            return text.includes(trimmed)
        })
        setResults(matches)
    }

    function handleSearch(e) {
        const q = e.target.value
        setQuery(q)
        clearTimeout(debounceRef.current)
        if (!q.trim()) { setResults([]); return }
        debounceRef.current = setTimeout(() => performSearch(q), 150)
    }

    function handleSelect(item) {
        onClose()
        if (item.type === 'folder') {
            navigate(`/?folder=${item.id}`)
        } else {
            navigate(`/note/${item.id}`)
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 flex items-start justify-center z-[100] backdrop-blur-sm pt-24"
            style={{ backgroundColor: 'var(--modal-bg)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-2xl mx-4 shadow-2xl rounded-xl overflow-hidden flex flex-col"
                style={{ maxHeight: '60vh', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
                {/* Search Input */}
                <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <Search className="w-5 h-5 opacity-50" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleSearch}
                        className="w-full bg-transparent outline-none text-lg"
                        style={{ color: 'var(--text-main)' }}
                        placeholder="Search notes..."
                        autoComplete="off"
                    />
                    <button
                        onClick={onClose}
                        className="hidden md:block text-xs border px-2 py-1 rounded opacity-50 cursor-pointer"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                    >
                        ESC
                    </button>
                    <button onClick={onClose} className="md:hidden p-2 cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Results */}
                <div className="overflow-y-auto p-2 flex flex-col gap-1">
                    {query.trim() === '' ? (
                        <div className="text-center py-8 text-sm opacity-50" style={{ color: 'var(--text-muted)' }}>Type to start searching...</div>
                    ) : results.length === 0 ? (
                        <div className="text-center py-8 text-sm opacity-50" style={{ color: 'var(--text-muted)' }}>No matching notes found.</div>
                    ) : (
                        results.map((item) => {
                            let icon, title, snippet
                            if (item.type === 'folder') {
                                icon = (
                                    <Folder className="w-5 h-5 text-yellow-500" fill="currentColor" />
                                )
                                title = item.name
                                snippet = 'Folder'
                            } else {
                                icon = (
                                    <FileText className="w-5 h-5 opacity-40" strokeWidth={2} />
                                )
                                const lines = parseNoteContent(item.content)
                                title = lines[0] || 'Untitled'
                                const cleanText = item.content.replace(/<[^>]*>?/gm, ' ')
                                const lowerText = cleanText.toLowerCase()
                                const matchIndex = lowerText.indexOf(query.toLowerCase().trim())
                                if (matchIndex > -1) {
                                    const start = Math.max(0, matchIndex - 20)
                                    const end = Math.min(cleanText.length, matchIndex + 60)
                                    snippet = (start > 0 ? '...' : '') + cleanText.substring(start, end) + '...'
                                } else {
                                    snippet = lines.slice(1).join(' ').substring(0, 60)
                                }
                            }

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className="search-result-item flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                                    style={{ borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <div className="flex-shrink-0">{icon}</div>
                                    <div className="flex-grow min-w-0">
                                        <div className="font-medium truncate text-sm" style={{ color: 'var(--text-main)' }}>{highlightMatch(title, query.trim())}</div>
                                        <div className="text-xs truncate opacity-60" style={{ color: 'var(--text-muted)' }}>{highlightMatch(snippet, query.trim())}</div>
                                    </div>
                                    <div className="text-xs opacity-40 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{formatDate(item.updatedAt)}</div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
