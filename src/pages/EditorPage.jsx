import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { saveWordStats, countWords } from '../hooks/useStats'
import { ArrowLeft, Check, Info, Menu, Eye, Maximize } from 'lucide-react'

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
            // Setup blank structural height using br so native browser selection jumps into it properly immediately.
            editableRef.current.innerHTML = '<span class="active-sentence first-sentence" data-empty="true">&#8203;</span>'
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
        if (!el.firstChild || el.innerHTML.replace(/\u200B/g, '').trim() === '') {
            // For zero-content states, contentEditable needs a br or structural height to click into.
            el.innerHTML = '<span class="active-sentence first-sentence" data-empty="true">&#8203;</span>'
        }
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
        if (!wrapper || !editable) return
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        let node = selection.anchorNode
        while (node && node.parentNode !== editable && node.parentNode !== document.body) {
            node = node.parentNode
        }

        if (currentModeRef.current === 'spotlight') {
            applySentenceFocus(editable)
        } else {
            // Remove any sentence spans if we switch back to paragraph
            const spans = editable.querySelectorAll('span.active-sentence, span.inactive-sentence')
            if (spans.length > 0) {
                const savedCursor = saveCursor(editable)
                spans.forEach(span => {
                    const parent = span.parentNode
                    while (span.firstChild) parent.insertBefore(span.firstChild, span)
                    parent.removeChild(span)
                })
                restoreCursor(editable, savedCursor)
            }
        }
    }

    function saveCursor(root) {
        const selection = window.getSelection()
        if (selection.rangeCount === 0) return 0
        const range = selection.getRangeAt(0)

        const nodes = []
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false)
        let n = walker.nextNode()
        while (n) {
            if (n.nodeType === 3 || n.nodeName === 'BR') nodes.push(n)
            n = walker.nextNode()
        }

        let charIndex = 0
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            const nodeRange = document.createRange()
            if (node.nodeType === 3) nodeRange.setStart(node, 0)
            else nodeRange.setStartBefore(node)

            if (range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0) {
                break
            }

            if (node === range.startContainer && node.nodeType === 3) {
                const preCursorText = node.nodeValue.substring(0, range.startOffset)
                charIndex += preCursorText.replace(/\u200B/g, '').length
                break
            }

            if (node.nodeType === 3) {
                charIndex += node.nodeValue.replace(/\u200B/g, '').length
            } else if (node.nodeName === 'BR') {
                charIndex += 1
            }
        }
        return charIndex
    }

    function restoreCursor(root, offset) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.setStart(root, 0)
        range.collapse(true)

        const nodes = []
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false)
        let n = walker.nextNode()
        while (n) {
            if (n.nodeType === 3 || n.nodeName === 'BR') nodes.push(n)
            n = walker.nextNode()
        }

        let charIndex = 0
        let found = false
        let lastNode = null

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]

            if (node.nodeType === 3) {
                const len = node.nodeValue.replace(/\u200B/g, '').length

                if (offset < charIndex + len || (offset === charIndex + len && i === nodes.length - 1)) {
                    let innerOffset = offset - charIndex

                    // Identify how many ZWS characters exist before our target logical index
                    // to adjust the exact native DOM string index
                    let logicalCount = 0
                    let nativeIndex = 0
                    for (; nativeIndex < node.nodeValue.length; nativeIndex++) {
                        if (logicalCount === innerOffset) break
                        if (node.nodeValue.charCodeAt(nativeIndex) !== 8203) logicalCount++
                    }
                    // If target was precisely at end, advance past any trailing ZWS (though they usually stand prefix)
                    while (nativeIndex < node.nodeValue.length && node.nodeValue.charCodeAt(nativeIndex) === 8203) {
                        nativeIndex++
                    }

                    range.setStart(node, nativeIndex)
                    found = true
                    break
                }
                charIndex += len
            } else if (node.nodeName === 'BR') {
                if (offset === charIndex) {
                    range.setStartBefore(node)
                    found = true
                    break
                }
                charIndex += 1
            }
            lastNode = node
        }

        if (!found && lastNode) {
            if (lastNode.nodeType === 3) {
                range.setStart(lastNode, lastNode.nodeValue.length)
            } else {
                range.setStartAfter(lastNode)
            }
        }

        selection.removeAllRanges()
        selection.addRange(range)
    }

    function applySentenceFocus(editable) {
        // Only apply if user isn't actively making a selection drag
        const selection = window.getSelection()
        if (!selection.isCollapsed) return

        const offset = saveCursor(editable)
        let text = ''
        function extractText(node) {
            if (node.nodeType === 3) {
                text += node.nodeValue
            } else if (node.nodeName === 'BR') {
                text += '\n'
            } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
                text += '\n'
                for (let i = 0; i < node.childNodes.length; i++) extractText(node.childNodes[i])
            } else {
                for (let i = 0; i < node.childNodes.length; i++) extractText(node.childNodes[i])
            }
        }
        extractText(editable)

        const regex = /[^.!?\n]+[.!?\n]+/g
        let match
        const boundaries = []
        let lastIdx = 0
        while ((match = regex.exec(text)) !== null) {
            boundaries.push({ start: match.index, end: match.index + match[0].length })
            lastIdx = match.index + match[0].length
        }
        if (lastIdx < text.length) boundaries.push({ start: lastIdx, end: text.length })

        let activeIndex = -1
        let isAtBoundaryEnd = false
        for (let i = 0; i < boundaries.length; i++) {
            if (offset >= boundaries[i].start && offset < boundaries[i].end) {
                activeIndex = i
                break
            }
            if (offset === boundaries[i].end) {
                const boundaryStr = text.substring(boundaries[i].start, boundaries[i].end)
                if (/[.!?\n]$/.test(boundaryStr)) {
                    isAtBoundaryEnd = true
                    activeIndex = i + 1
                } else {
                    activeIndex = i
                }
            }
        }
        if (activeIndex === -1 && boundaries.length > 0) activeIndex = boundaries.length - 1
        if (activeIndex >= boundaries.length && isAtBoundaryEnd) {
            boundaries.push({ start: text.length, end: text.length })
            activeIndex = boundaries.length - 1
        }

        // --- Fast Path DOM class updater ---
        // Avoid destroying innerHTML and losing native selection if structure hasn't fundamentally changed.
        const currentSpans = Array.from(editable.querySelectorAll('span.active-sentence, span.inactive-sentence'))
        const hasDivs = editable.querySelector('div, p') !== null
        const rawEmpty = text.replace(/[\n\u200B]/g, '').trim().length === 0

        if (!hasDivs && currentSpans.length === boundaries.length) {
            for (let i = 0; i < boundaries.length; i++) {
                const span = currentSpans[i]
                const isFirst = i === 0 ? ' first-sentence' : ''
                span.className = (i === activeIndex ? 'active-sentence' : 'inactive-sentence') + isFirst
                if (rawEmpty && i === 0) span.setAttribute('data-empty', 'true')
                else span.removeAttribute('data-empty')
            }
            return
        }
        // --- End Fast Path ---

        let html = ''
        for (let i = 0; i < boundaries.length; i++) {
            const b = boundaries[i]
            let sentenceText = text.substring(b.start, b.end)

            // Clean zero-width spaces that might have snuck into extraction
            sentenceText = sentenceText.replace(/\u200B/g, '')

            const isFirst = i === 0 ? ' first-sentence' : ''
            const isEmpty = text.replace(/[\n\u200B]/g, '').trim().length === 0 ? ' data-empty="true"' : ''

            if (sentenceText.length > 0) {
                let textContent = sentenceText
                let trailingBr = ''

                const trailingMatch = textContent.match(/\n+$/)
                if (trailingMatch) {
                    textContent = textContent.substring(0, textContent.length - trailingMatch[0].length)
                    trailingBr = '<br>'.repeat(trailingMatch[0].length)
                }

                const leadingMatch = textContent.match(/^\n+/)
                let leadingBr = ''
                if (leadingMatch) {
                    textContent = textContent.substring(leadingMatch[0].length)
                    leadingBr = '<br>'.repeat(leadingMatch[0].length)
                }

                html += leadingBr
                if (textContent.length > 0) {
                    html += `<span class="${i === activeIndex ? 'active-sentence' : 'inactive-sentence'}${isFirst}"${isEmpty}>${textContent}</span>`
                } else if (i === activeIndex) {
                    html += `<span class="active-sentence${isFirst}"${isEmpty}>&#8203;</span>`
                }
                html += trailingBr
            } else if (i === activeIndex) {
                html += `<span class="active-sentence${isFirst}"${isEmpty}>&#8203;</span>`
            }
        }

        // Clean out zero width space bugs affecting backwards typing check
        const cleanInner = (str) => typeof str === 'string' ? str.replace(/\u200B/g, '') : ''
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html
        if (cleanInner(editable.innerText) === cleanInner(tempDiv.innerText) && cleanInner(editable.innerHTML) === cleanInner(html)) return

        editable.innerHTML = html
        restoreCursor(editable, offset)
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
            e.preventDefault()
            const selection = window.getSelection()
            if (!selection.rangeCount) return

            // Insert newline explicitly
            const range = selection.getRangeAt(0)
            range.deleteContents()
            const br = document.createElement('br')
            const textNode = document.createTextNode('\u200B') // zero width space after br helps cursor
            range.insertNode(textNode)
            range.insertNode(br)
            range.setStartAfter(textNode)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)

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
        if (!el) return

        const range = document.createRange()
        const sel = window.getSelection()

        // Find deepest last child to ensure cursor actually falls inside spans
        let lastNode = el
        while (lastNode.lastChild) {
            lastNode = lastNode.lastChild
        }

        if (lastNode.nodeType === 3) {
            range.setStart(lastNode, lastNode.nodeValue.length)
        } else {
            range.selectNodeContents(lastNode)
        }

        range.collapse(true)
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

    const modeLabel = currentModeRef.current === 'spotlight' ? 'Switch to Normal Mode' : 'Switch to Focus Mode'

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
                            <ArrowLeft className="w-5 h-5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                        </a>

                        {/* Word count + stats popover */}
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
                                className="p-1 rounded-full transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <Info className="w-4 h-4 text-inherit" />
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
                                <Menu className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                            </button>

                            <div
                                className={`popover-menu absolute bottom-full mb-4 right-0 w-48 rounded-xl shadow-2xl z-50 overflow-hidden origin-bottom-right ${menuOpen ? 'popover-visible' : 'popover-hidden'}`}
                                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-col py-1">
                                    <button onClick={toggleMode} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ color: 'var(--text-main)' }}>
                                        <Eye className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        {modeLabel}
                                    </button>
                                    <button onClick={toggleZen} className="text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800" style={{ borderTop: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                        <Maximize className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
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
