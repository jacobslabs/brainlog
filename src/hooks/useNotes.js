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
    // Normalize <br> variants into newlines, then strip remaining tags
    const text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>\s*<div[^>]*>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00A0/g, ' ')
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
}
