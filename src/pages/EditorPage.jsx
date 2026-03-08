import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveWordStats, countWords } from '../hooks/useStats'
import { getItemsCached, saveItemsCached } from '../hooks/useNotes'
import { ArrowLeft, Check, Info, Menu, Maximize } from 'lucide-react'

// Strip legacy span wrappers from old saved content
function migrateContent(html) {
    return html
        .replace(/<span[^>]*class="[^"]*(?:active|inactive)-sentence[^"]*"[^>]*>/g, '')
        .replace(/<\/span>/g, '')
        .replace(/\u200B/g, '')
}

// Build a flat text map from the editable DOM: [{node, start, end}, ...]
function getTextMap(root) {
    const entries = []
    let offset = 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
    let n = walker.nextNode()
    while (n) {
        if (n.nodeType === 3) {
            const len = n.nodeValue.length
            entries.push({ node: n, start: offset, end: offset + len })
            offset += len
        } else if (n.nodeName === 'BR') {
            entries.push({ node: n, start: offset, end: offset + 1, isBr: true })
            offset += 1
        }
        n = walker.nextNode()
    }
    return { entries, length: offset }
}

// Get cursor offset as a flat character index
function getCursorOffset(root) {
    const sel = window.getSelection()
    if (!sel.rangeCount || !sel.isCollapsed) return -1
    const anchor = sel.anchorNode
    const anchorOff = sel.anchorOffset
    const { entries } = getTextMap(root)
    for (const e of entries) {
        if (e.isBr) continue
        if (e.node === anchor) return e.start + anchorOff
    }
    // Anchor might be the root or a BR parent — find by child index
    if (anchor === root) {
        let off = 0
        for (let i = 0; i < anchorOff && i < root.childNodes.length; i++) {
            const child = root.childNodes[i]
            if (child.nodeType === 3) off += child.nodeValue.length
            else if (child.nodeName === 'BR') off += 1
        }
        return off
    }
    return entries.length > 0 ? entries[entries.length - 1].end : 0
}

// Create a DOM Range spanning [start, end) in flat text space
function makeRange(entries, start, end) {
    const range = document.createRange()
    let rangeStartSet = false
    for (const e of entries) {
        if (e.isBr) continue
        // Set start
        if (!rangeStartSet && e.end > start) {
            range.setStart(e.node, Math.max(0, start - e.start))
            rangeStartSet = true
        }
        // Set end
        if (rangeStartSet && e.end >= end) {
            range.setEnd(e.node, Math.min(e.node.nodeValue.length, end - e.start))
            return range
        }
    }
    // Fallback: collapse at the end
    if (!rangeStartSet && entries.length > 0) {
        const last = entries[entries.length - 1]
        if (!last.isBr) { range.setStart(last.node, last.node.nodeValue.length); range.setEnd(last.node, last.node.nodeValue.length) }
    }
    return range
}

export default function EditorPage() {
    const { id: NOTE_ID } = useParams()
    const navigate = useNavigate()
    const wrapperRef = useRef(null)
    const editableRef = useRef(null)

    const [wordCount, setWordCount] = useState(0)
    const [sentenceCount, setSentenceCount] = useState(0)
    const [readTime, setReadTime] = useState(0)
    const [saveState, setSaveState] = useState('idle')
    const [menuOpen, setMenuOpen] = useState(false)
    const [statsOpen, setStatsOpen] = useState(false)

    const saveTimeoutRef = useRef(null)
    const visualTimeoutRef = useRef(null)
    const isAutoScrollingRef = useRef(false)
    const scrollTimeoutRef = useRef(null)
    const startWordCountRef = useRef(0)
    const latestWordCountRef = useRef(0)
    const lastProfileSyncRef = useRef(0)
    const [progressPct, setProgressPct] = useState(0)
    const [showProgress, setShowProgress] = useState(false)

    // ---- HIGHLIGHT (sentence focus) ----
    const updateHighlight = useCallback(() => {
        const el = editableRef.current
        if (!el || !CSS.highlights) return

        const cursorOff = getCursorOffset(el)
        if (cursorOff < 0) { CSS.highlights.delete('active-sentence'); return }

        const { entries, length } = getTextMap(el)
        if (length === 0) { CSS.highlights.delete('active-sentence'); return }

        // Build flat text string to find sentence boundaries
        let text = ''
        for (const e of entries) {
            if (e.isBr) text += '\n'
            else text += e.node.nodeValue
        }

        // Find active sentence boundaries around cursor
        // Delimiters: . ? ! and newline
        let sentenceStart = 0
        let sentenceEnd = text.length
        let foundDelimiter = null

        // Scan backward for delimiter
        for (let i = cursorOff - 1; i >= 0; i--) {
            const ch = text[i]
            if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') {
                sentenceStart = i + 1
                foundDelimiter = ch
                break
            }
        }

        // For punctuation (not newline): only split if user has typed content after the delimiter.
        // This keeps the sentence highlighted until the user actually starts the next one.
        if (foundDelimiter && foundDelimiter !== '\n') {
            const afterDelimiter = text.substring(sentenceStart, cursorOff)
            if (afterDelimiter.trim().length === 0) {
                // Nothing typed yet — extend back to include the previous sentence
                const delimIdx = sentenceStart - 1 // position of the delimiter itself
                sentenceStart = 0
                for (let i = delimIdx - 1; i >= 0; i--) {
                    const ch = text[i]
                    if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') {
                        sentenceStart = i + 1
                        break
                    }
                }
            }
        }

        // Scan forward for delimiter
        for (let i = cursorOff; i < text.length; i++) {
            const ch = text[i]
            if (ch === '.' || ch === '?' || ch === '!' || ch === '\n') {
                sentenceEnd = i + 1 // include the delimiter
                break
            }
        }

        // Skip leading whitespace in the active sentence
        while (sentenceStart < sentenceEnd && /\s/.test(text[sentenceStart])) sentenceStart++

        if (sentenceStart >= sentenceEnd) {
            CSS.highlights.delete('active-sentence')
            return
        }

        try {
            const range = makeRange(entries, sentenceStart, sentenceEnd)
            CSS.highlights.set('active-sentence', new Highlight(range))
        } catch {
            CSS.highlights.delete('active-sentence')
        }
    }, [])

    // ---- SCROLL ENGINE (typewriter centering) ----
    function scrollEngine(instant = false) {
        const wrapper = wrapperRef.current
        if (!wrapper) return
        const sel = window.getSelection()
        if (!sel.rangeCount) return
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        if (rect.top === 0 && rect.bottom === 0) return
        const wRect = wrapper.getBoundingClientRect()
        // On mobile, position cursor at ~35% from top to leave room above keyboard
        const ratio = window.innerWidth < 768 ? 0.35 : 0.5
        const offset = (rect.top - wRect.top) - (wRect.height * ratio) + (rect.height / 2)
        if (Math.abs(offset) > 1) {
            isAutoScrollingRef.current = true
            clearTimeout(scrollTimeoutRef.current)
            if (instant) wrapper.scrollTop += offset
            else wrapper.scrollTo({ top: wrapper.scrollTop + offset, behavior: 'smooth' })
            scrollTimeoutRef.current = setTimeout(() => { isAutoScrollingRef.current = false }, 500)
        }
    }

    // ---- SAVE ----
    function renderStatus(state) {
        setSaveState(state)
        if (state === 'saving') {
            clearTimeout(visualTimeoutRef.current)
            visualTimeoutRef.current = setTimeout(() => setSaveState('saved'), 1200)
        }
    }

    function queueSave() {
        clearTimeout(saveTimeoutRef.current)
        setSaveState('idle')
        saveTimeoutRef.current = setTimeout(performSave, 1000)
    }

    function performSave() {
        if (!NOTE_ID) return
        const notes = getItemsCached()
        const idx = notes.findIndex(n => n.id === NOTE_ID)
        if (idx > -1) {
            notes[idx].content = editableRef.current.innerHTML
            notes[idx].updatedAt = Date.now()
            saveItemsCached(notes)
            db.pushItem(notes[idx])

            // Deferred stat tracking (moved from per-keystroke to per-save)
            const currentCount = latestWordCountRef.current
            const delta = currentCount - startWordCountRef.current
            if (delta !== 0) {
                saveWordStats(delta)
                startWordCountRef.current = currentCount
            }

            // Update progress bar
            updateProgressBar()

            // Throttled profile sync (once per 30s instead of every save)
            const now = Date.now()
            if (now - lastProfileSyncRef.current >= 30000) {
                lastProfileSyncRef.current = now
                db.updateProfile()
            }

            renderStatus('saving')
        }
    }

    // ---- STATS ----
    function updateProgressBar() {
        const dailyGoal = parseInt(localStorage.getItem('brainlog_daily_goal') || 0)
        if (dailyGoal > 0) {
            const stats = JSON.parse(localStorage.getItem('brainlog_stats') || '{"daily":{}}')
            const today = new Date().toISOString().split('T')[0]
            const dailyTotal = stats.daily?.[today] || 0
            const pct = Math.min((dailyTotal / dailyGoal) * 100, 100)
            setProgressPct(pct)
            setShowProgress(true)
        } else {
            setShowProgress(false)
        }
    }

    // ---- HANDLERS ----
    function handleInput() {
        const text = editableRef.current?.innerText || ''
        const wc = countWords(text)
        latestWordCountRef.current = wc

        // Update display state immediately
        setWordCount(wc)
        setSentenceCount(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length)
        setReadTime(Math.ceil(wc / 200))

        queueSave()
        requestAnimationFrame(() => {
            updateHighlight()
            scrollEngine(false)
        })
    }

    function handleKeyDown(e) {
        document.body.classList.remove('is-scrolling')
        if (e.key === 'Enter') {
            e.preventDefault()
            document.execCommand('insertLineBreak')
            // onInput event will trigger handleInput for stats/save/highlight
        }
    }

    const handleSelectionChange = useCallback(() => {
        if (document.activeElement === editableRef.current) {
            updateHighlight()
            requestAnimationFrame(() => scrollEngine(false))
        }
    }, [updateHighlight])

    function handleScroll() {
        if (!isAutoScrollingRef.current && !document.body.classList.contains('is-scrolling')) {
            document.body.classList.add('is-scrolling')
        }
    }

    function handlePaste(e) {
        e.preventDefault()
        const text = (e.clipboardData || window.clipboardData).getData('text/plain')
        document.execCommand('insertText', false, text)
        handleInput()
    }

    function setCursorToEnd() {
        const el = editableRef.current
        if (!el) return
        const range = document.createRange()
        const sel = window.getSelection()
        let lastNode = el
        while (lastNode.lastChild) lastNode = lastNode.lastChild
        if (lastNode.nodeType === 3) range.setStart(lastNode, lastNode.nodeValue.length)
        else range.selectNodeContents(lastNode)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
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

    // ---- INIT ----
    useEffect(() => {
        if (!NOTE_ID) { navigate('/'); return }
        const notes = getItemsCached()
        const note = notes.find(n => n.id === NOTE_ID)

        if (note) {
            editableRef.current.innerHTML = migrateContent(note.content)
            renderStatus('saved')
        }

        setCursorToEnd()
        editableRef.current.focus()

        const text = editableRef.current?.innerText || ''
        const wc = countWords(text)
        latestWordCountRef.current = wc
        startWordCountRef.current = wc
        setWordCount(wc)
        setSentenceCount(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length)
        setReadTime(Math.ceil(wc / 200))
        updateProgressBar()
        updateHighlight()

        let attempts = 0
        const interval = setInterval(() => {
            scrollEngine(true)
            attempts++
            if (attempts > 5) { clearInterval(interval); wrapperRef.current?.classList.add('ready') }
        }, 20)

        const handleBeforeUnload = () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
                performSave()
            }
            db.updateProfile()
        }
        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            // Flush pending save on unmount
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
                performSave()
            }
            db.updateProfile()
            clearInterval(interval)
            clearTimeout(visualTimeoutRef.current)
            CSS.highlights?.delete('active-sentence')
            document.body.classList.remove('zen-mode', 'is-scrolling')
        }
        // eslint-disable-next-line
    }, [NOTE_ID])

    // Selection change listener
    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [handleSelectionChange])

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

    // ---- RENDER ----
    return (
        <div className="flex flex-col items-center justify-center overflow-hidden" style={{ height: '100dvh', backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}>
            <div className="w-full max-w-5xl flex flex-col h-full md:h-[90vh] md:my-6 editor-container relative">

                <div
                    id="editor-wrapper"
                    ref={wrapperRef}
                    className="flex-grow overflow-y-auto px-6 md:px-32 relative"
                    onScroll={handleScroll}
                >
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
                    <div id="daily-progress-container" style={{ display: showProgress ? '' : 'none' }} title="Daily Goal Progress">
                        <div id="daily-progress-bar" className={progressPct >= 100 ? 'goal-met' : progressPct > 0 ? 'active' : ''} style={{ width: `${progressPct}%` }} />
                    </div>

                    <div className="flex items-center gap-8 h-10 relative">
                        <button
                            onClick={() => navigate(-1)}
                            className="footer-btn p-2 rounded-full h-10 w-10 flex items-center justify-center"
                            title="Back to Notes"
                        >
                            <ArrowLeft className="w-5 h-5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                        </button>

                        <div className="flex items-center gap-2 h-10 relative">
                            <div id="save-indicator">
                                {saveState === 'saving' && <div className="status-saving" />}
                                {saveState === 'saved' && (
                                    <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
                                )}
                            </div>
                            <span className="font-medium text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{wordCount} words</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setStatsOpen(v => !v); setMenuOpen(false) }}
                                onMouseEnter={() => setStatsOpen(true)}
                                onMouseLeave={() => setStatsOpen(false)}
                                className="p-1 rounded-full transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <Info className="w-4 h-4 text-inherit" />
                            </button>
                            <div className={`popover-menu popover-center absolute bottom-full mb-4 left-1/2 px-4 py-2 rounded-lg shadow-xl text-xs z-50 whitespace-nowrap ${statsOpen ? 'popover-visible' : 'popover-hidden'}`}
                                style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-card)' }}>
                                <div>{sentenceCount} sentences</div>
                                <div className="opacity-70 mt-1">~{readTime} min read</div>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: 'var(--text-main)' }} />
                            </div>
                        </div>

                        <div className="relative">
                            <button
                                id="editor-menu-toggle"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); setStatsOpen(false) }}
                                className="footer-btn p-2 rounded-full h-10 w-10 flex items-center justify-center"
                            >
                                <Menu className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                            </button>

                            <div
                                className={`popover-menu absolute bottom-full mb-4 right-0 w-48 rounded-xl shadow-2xl z-50 overflow-hidden origin-bottom-right ${menuOpen ? 'popover-visible' : 'popover-hidden'}`}
                                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-col py-1">
                                    <button onClick={toggleZen} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ color: 'var(--text-main)' }}>
                                        <Maximize className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        Zen Mode
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
