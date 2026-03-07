import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveWordStats, countWords } from '../hooks/useStats'

const STORAGE_KEY = 'elegant_writer_notes'
const KEY_MODE = 'elegant_writer_mode'

function getNotes() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }

export default function EditorPage() {
    const { id: NOTE_ID } = useParams()
    const navigate = useNavigate()
    const wrapperRef = useRef(null)
    const editableRef = useRef(null)
    const overlayRef = useRef(null)

    const [wordCount, setWordCount] = useState(0)
    const [sentenceCount, setSentenceCount] = useState(0)
    const [readTime, setReadTime] = useState(0)
    const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved'
    const [menuOpen, setMenuOpen] = useState(false)
    const [statsOpen, setStatsOpen] = useState(false)
    const [backHref, setBackHref] = useState('/')

    const saveTimeoutRef = useRef(null)
    const visualTimeoutRef = useRef(null)
    const isAutoScrollingRef = useRef(false)
    const scrollTimeoutRef = useRef(null)
    const currentModeRef = useRef('paragraph')
    const activeBlockRef = useRef(null)
    const startWordCountRef = useRef(0)

    // ---- INIT ----
    useEffect(() => {
        const body = document.body
        const savedMode = localStorage.getItem(KEY_MODE) || 'paragraph'
        setMode(savedMode)

        if (!NOTE_ID) { navigate('/'); return }
        const notes = getNotes()
        const note = notes.find(n => n.id === NOTE_ID)

        if (note) {
            editableRef.current.innerHTML = note.content
            if (note.parentId) setBackHref(`/?folder=${note.parentId}`)
            renderStatus('saved')
        } else {
            editableRef.current.innerHTML = '<div><br></div>'
        }

        ensureStructure()
        setCursorToEnd()
        editableRef.current.focus()
        updateStats()
        syncOverlaySize()
        updateFocus()

        const text = editableRef.current?.innerText || ''
        startWordCountRef.current = countWords(text)

        let attempts = 0
        const interval = setInterval(() => {
            forceCenter()
            attempts++
            if (attempts > 5) { clearInterval(interval); wrapperRef.current?.classList.add('ready') }
        }, 20)

        return () => {
            clearInterval(interval)
            clearTimeout(saveTimeoutRef.current)
            clearTimeout(visualTimeoutRef.current)
            body.classList.remove('mode-spotlight', 'mode-paragraph', 'zen-mode', 'is-scrolling')
        }
        // eslint-disable-next-line
    }, [NOTE_ID])

    // Zen mousemove
    useEffect(() => {
        let zenTimeout
        const handler = () => {
            if (!document.body.classList.contains('zen-mode')) return
            document.body.classList.add('zen-ui-visible')
            clearTimeout(zenTimeout)
            zenTimeout = setTimeout(() => document.body.classList.remove('zen-ui-visible'), 2000)
        }
        document.addEventListener('mousemove', handler)
        return () => { document.removeEventListener('mousemove', handler); clearTimeout(zenTimeout) }
    }, [])

    // Fullscreen exit
    useEffect(() => {
        const handler = () => { if (!document.fullscreenElement) document.body.classList.remove('zen-mode') }
        document.addEventListener('fullscreenchange', handler)
        return () => document.removeEventListener('fullscreenchange', handler)
    }, [])

    // Close menus on click outside
    useEffect(() => {
        const handler = () => { setMenuOpen(false); setStatsOpen(false) }
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [])

    // ---- CORE FUNCTIONS ----
    function setMode(mode) {
        currentModeRef.current = mode
        const body = document.body
        if (mode === 'spotlight') { body.classList.replace('mode-paragraph', 'mode-spotlight') || body.classList.add('mode-spotlight'); body.classList.remove('mode-paragraph') }
        else { body.classList.replace('mode-spotlight', 'mode-paragraph') || body.classList.add('mode-paragraph'); body.classList.remove('mode-spotlight') }
        localStorage.setItem(KEY_MODE, mode)
    }

    function renderStatus(state) {
        setSaveState(state)
        if (state === 'saving') {
            clearTimeout(visualTimeoutRef.current)
            visualTimeoutRef.current = setTimeout(() => setSaveState('saved'), 1200)
        }
    }

    function ensureStructure() {
        const el = editableRef.current
        if (!el) return
        if (!el.firstChild || el.innerHTML.trim() === '') el.innerHTML = '<div><br></div>'
    }

    function queueSave() {
        clearTimeout(saveTimeoutRef.current)
        setSaveState('idle')
        saveTimeoutRef.current = setTimeout(performSave, 1000)
    }

    function performSave() {
        if (!NOTE_ID) return
        const notes = getNotes()
        const idx = notes.findIndex(n => n.id === NOTE_ID)
        if (idx > -1) {
            notes[idx].content = editableRef.current.innerHTML
            notes[idx].updatedAt = Date.now()
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
            db.pushItem(notes[idx])
            db.updateProfile()
            renderStatus('saving')
        }
    }

    function updateStats() {
        const el = editableRef.current
        if (!el) return
        const text = el.innerText || ''
        const wc = countWords(text)
        const sc = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length
        const rt = Math.ceil(wc / 200)
        setWordCount(wc)
        setSentenceCount(sc)
        setReadTime(rt)

        // Daily progress bar
        const dailyGoal = parseInt(localStorage.getItem('brainlog_daily_goal') || 0)
        const bar = document.getElementById('daily-progress-bar')
        const barContainer = document.getElementById('daily-progress-container')
        if (bar && barContainer) {
            if (dailyGoal > 0) {
                const stats = JSON.parse(localStorage.getItem('brainlog_stats') || '{"daily":{}}')
                const today = new Date().toISOString().split('T')[0]
                const dailyTotal = stats.daily?.[today] || 0
                const pct = Math.min((dailyTotal / dailyGoal) * 100, 100)
                bar.style.width = `${pct}%`
                barContainer.style.display = 'block'
                bar.className = pct >= 100 ? 'goal-met' : pct > 0 ? 'active' : ''
            } else {
                barContainer.style.display = 'none'
            }
        }
    }

    function updateTracking() {
        const text = editableRef.current?.innerText || ''
        const currentCount = countWords(text)
        const delta = currentCount - startWordCountRef.current
        if (delta !== 0) { saveWordStats(delta); startWordCountRef.current = currentCount }
    }

    function updateFocus() {
        const wrapper = wrapperRef.current
        const editable = editableRef.current
        const overlay = overlayRef.current
        if (!wrapper || !editable) return
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        let node = selection.anchorNode
        while (node && node.parentNode !== editable) node = node.parentNode

        if (currentModeRef.current === 'paragraph') {
            if (node && node.nodeName === 'DIV') {
                if (activeBlockRef.current !== node) {
                    activeBlockRef.current?.classList.remove('active-block')
                    node.classList.add('active-block')
                    activeBlockRef.current = node
                }
            }
        }

        if (currentModeRef.current === 'spotlight' && overlay) {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            let top = rect.top, bottom = rect.bottom
            if (rect.height === 0 && node) { const pr = node.getBoundingClientRect(); top = pr.top; bottom = pr.bottom }
            const wRect = wrapper.getBoundingClientRect()
            const relTop = top - wRect.top + wrapper.scrollTop
            const relBottom = bottom - wRect.top + wrapper.scrollTop
            overlay.style.setProperty('--focus-top', `${relTop - 8}px`)
            overlay.style.setProperty('--focus-bottom', `${relBottom + 8}px`)
        }
    }

    function syncOverlaySize() {
        const editable = editableRef.current
        const overlay = overlayRef.current
        if (currentModeRef.current === 'spotlight' && overlay && editable) {
            overlay.style.height = `${editable.scrollHeight}px`
        }
    }

    function scrollEngine(instant = false) {
        const wrapper = wrapperRef.current
        if (!wrapper) return
        const selection = window.getSelection()
        if (!selection.rangeCount) return
        let targetRect = null
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        if (rect.top !== 0 || rect.bottom !== 0) targetRect = rect
        else if (activeBlockRef.current) targetRect = activeBlockRef.current.getBoundingClientRect()
        if (!targetRect) return
        const wRect = wrapper.getBoundingClientRect()
        const relTop = targetRect.top - wRect.top
        const targetY = wRect.height / 2
        const offset = relTop - targetY + (targetRect.height / 2)
        if (Math.abs(offset) > 1) {
            isAutoScrollingRef.current = true
            clearTimeout(scrollTimeoutRef.current)
            if (instant) wrapper.scrollTop += offset
            else wrapper.scrollTo({ top: wrapper.scrollTop + offset, behavior: 'smooth' })
            scrollTimeoutRef.current = setTimeout(() => { isAutoScrollingRef.current = false }, 500)
        }
    }

    function forceCenter() { scrollEngine(true) }

    function handleInput(e) {
        updateTracking()
        ensureStructure()
        syncOverlaySize()
        updateFocus()
        updateStats()
        queueSave()
        if (e.nativeEvent?.inputType !== 'insertParagraph') {
            requestAnimationFrame(() => scrollEngine(false))
        }
    }

    function handleKeyDown(e) {
        document.body.classList.remove('is-scrolling')
        if (e.key === 'Enter') {
            setTimeout(() => { ensureStructure(); updateFocus(); scrollEngine(true); queueSave() }, 0)
        }
    }

    function handleSelectionChange() {
        if (document.activeElement === editableRef.current) {
            updateFocus()
            requestAnimationFrame(() => scrollEngine(false))
        }
    }

    function handleScroll() {
        if (!isAutoScrollingRef.current && !document.body.classList.contains('is-scrolling')) {
            document.body.classList.add('is-scrolling')
        }
    }

    function handlePaste(e) {
        e.preventDefault()
        const text = (e.clipboardData || window.clipboardData).getData('text/plain')
        document.execCommand('insertText', false, text)
        handleInput({ nativeEvent: { inputType: 'insertText' } })
    }

    function setCursorToEnd() {
        const el = editableRef.current
        if (!el?.lastChild) return
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(el)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
    }

    function toggleMode() {
        const next = currentModeRef.current === 'spotlight' ? 'paragraph' : 'spotlight'
        setMode(next)
        updateFocus()
        forceCenter()
        setMenuOpen(false)
    }

    function toggleZen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { })
            document.body.classList.add('zen-mode')
            document.documentElement.classList.add('zen-active')
        } else {
            if (document.exitFullscreen) document.exitFullscreen()
            document.body.classList.remove('zen-mode')
            document.documentElement.classList.remove('zen-active')
        }
        setMenuOpen(false)
    }

    function downloadMarkdown() {
        const lines = editableRef.current?.querySelectorAll('div') || []
        let markdown = ''
        lines.forEach((line, index) => {
            let text = line.innerText.replace(/\n/g, '')
            if (index === 0 && text.trim().length > 0) markdown += `# ${text}\n\n`
            else { markdown += text; if (index < lines.length - 1) markdown += '\n\n' }
        })
        const firstLine = lines[0]?.innerText.trim() || 'Untitled'
        const safeName = firstLine.replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 30) || `note-${Date.now()}`
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${safeName}.md`; a.click()
        URL.revokeObjectURL(url)
        setMenuOpen(false)
    }

    const modeLabel = currentModeRef.current === 'spotlight' ? 'Switch to Paragraph' : 'Switch to Spotlight'

    return (
        <div className="flex flex-col items-center justify-center overflow-hidden mode-paragraph" style={{ height: '100dvh', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}>
            <div className="w-full max-w-5xl flex flex-col h-full md:h-[90vh] md:my-6 editor-container relative">

                {/* Scrollable editor area */}
                <div
                    id="editor-wrapper"
                    ref={wrapperRef}
                    className="flex-grow overflow-y-auto px-6 md:px-32 relative"
                    onScroll={handleScroll}
                >
                    <div id="focus-overlay" ref={overlayRef} />
                    <div
                        id="editable-area"
                        ref={editableRef}
                        className="max-w-2xl mx-auto"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Start writing..."
                        spellCheck={false}
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                    />
                </div>

                {/* Footer toolbar */}
                <div
                    id="app-footer"
                    className="fixed bottom-0 left-0 w-full z-50 flex justify-center items-start pt-3"
                    style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
                >
                    <div id="daily-progress-container" title="Daily Goal Progress">
                        <div id="daily-progress-bar" />
                    </div>

                    <div className="flex items-center gap-8 h-10 relative">
                        {/* Back button */}
                        <a
                            href={backHref}
                            className="footer-btn p-2 rounded-full h-10 w-10 flex items-center justify-center"
                            title="Back to Notes"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5" style={{ color: 'var(--text-muted)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </a>

                        {/* Word count + stats popover */}
                        <div className="flex items-center gap-2 h-10 relative">
                            <div id="save-indicator">
                                {saveState === 'saving' && <div className="status-saving" />}
                                {saveState === 'saved' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                            <span className="font-medium text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{wordCount} words</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setStatsOpen(v => !v); setMenuOpen(false) }}
                                className="p-1 rounded-full transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                            </button>
                            {/* Stats popover */}
                            <div className={`popover-menu popover-center absolute bottom-full mb-4 left-1/2 px-4 py-2 rounded-lg shadow-xl text-xs z-50 whitespace-nowrap ${statsOpen ? 'popover-visible' : 'popover-hidden'}`}
                                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-card)' }}>
                                <div>{sentenceCount} sentences</div>
                                <div className="opacity-70 mt-1">~{readTime} min read</div>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: 'var(--text-main)' }} />
                            </div>
                        </div>

                        {/* Editor options menu */}
                        <div className="relative">
                            <button
                                id="editor-menu-toggle"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); setStatsOpen(false) }}
                                className="footer-btn p-2 rounded-full h-10 w-10 flex items-center justify-center"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6" style={{ color: 'var(--text-muted)' }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            </button>

                            <div
                                className={`popover-menu absolute bottom-full mb-4 right-0 w-48 rounded-xl shadow-2xl z-50 overflow-hidden origin-bottom-right ${menuOpen ? 'popover-visible' : 'popover-hidden'}`}
                                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-col py-1">
                                    <button onClick={toggleMode} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ color: 'var(--text-main)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {modeLabel}
                                    </button>
                                    <button onClick={downloadMarkdown} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                        </svg>
                                        Download MD
                                    </button>
                                    <button onClick={toggleZen} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                        </svg>
                                        Zen Mode
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Selection change listener via useEffect */}
            <SelectionChangeListener onSelectionChange={handleSelectionChange} />
        </div>
    )
}

// Component to listen for selectionchange events
function SelectionChangeListener({ onSelectionChange }) {
    useEffect(() => {
        document.addEventListener('selectionchange', onSelectionChange)
        return () => document.removeEventListener('selectionchange', onSelectionChange)
    }, [onSelectionChange])
    return null
}
