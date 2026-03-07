import { useState, useCallback } from 'react'

const STORAGE_KEY = 'elegant_writer_notes'

export function useNotes() {
    const [, forceUpdate] = useState(0)

    const getItems = useCallback(() => {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    }, [])

    const saveLocal = useCallback((items) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
        forceUpdate((n) => n + 1)
    }, [])

    return { getItems, saveLocal }
}

export function formatDate(timestamp) {
    const diff = (new Date() - new Date(timestamp)) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(timestamp).toLocaleDateString()
}

export function parseNoteContent(html) {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    const lines = []
    Array.from(tmp.childNodes).forEach((node) => {
        let text = node.textContent || node.innerText || ''
        text = text.replace(/\u00A0/g, ' ').trim()
        if (text.length > 0) lines.push(text)
    })
    return lines
}
