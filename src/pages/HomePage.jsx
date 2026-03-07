import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { db } from '../lib/db'
import { formatDate, parseNoteContent } from '../hooks/useNotes'
import { CornerUpLeft, Trash2, X, Folder, Pencil } from 'lucide-react'

const STORAGE_KEY = 'elegant_writer_notes'

function getItems() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
}
function saveLocal(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export default function HomePage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const folderParam = searchParams.get('folder')
    const [currentFolderId, setCurrentFolderId] = useState(folderParam || 'root')
    const [items, setItems] = useState(() => getItems())
    const [modalState, setModalState] = useState({ open: false, mode: 'create', targetId: null, defaultValue: '' })
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('brainlog_view_mode') || 'grid-view')

    // Ensure viewMode is updated when returning to the page
    useEffect(() => {
        setViewMode(localStorage.getItem('brainlog_view_mode') || 'grid-view')
    }, [])

    const refresh = useCallback(() => setItems(getItems()), [])

    useEffect(() => {
        if (folderParam) setCurrentFolderId(folderParam)
        else setCurrentFolderId('root')
    }, [folderParam])

    useEffect(() => {
        window.addEventListener('notes-synced', refresh)
        return () => window.removeEventListener('notes-synced', refresh)
    }, [refresh])

    const navigateTo = useCallback((folderId) => {
        setCurrentFolderId(folderId)
        if (folderId === 'root') setSearchParams({})
        else if (folderId === 'trash') setSearchParams({ folder: 'trash' })
        else setSearchParams({ folder: folderId })
    }, [setSearchParams])

    const isTrash = currentFolderId === 'trash'

    // Build breadcrumbs
    const breadcrumbs = (() => {
        if (isTrash) return [{ id: 'trash', name: 'Trash Directory' }]
        const allItems = getItems()
        const path = []
        let tempId = currentFolderId
        let safety = 0
        while (tempId !== 'root' && safety < 50) {
            const folder = allItems.find(i => i.id === tempId)
            if (folder) { path.unshift({ id: folder.id, name: folder.name }); tempId = folder.parentId || 'root' }
            else { tempId = 'root' }
            safety++
        }
        path.unshift({ id: 'root', name: 'Home' })
        return path
    })()

    // Filtered & sorted items
    const visibleItems = (() => {
        return [...items]
            .filter(i => isTrash ? i.isTrashed : (!i.isTrashed && (i.parentId || 'root') === currentFolderId))
            .sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1
                if (a.type !== 'folder' && b.type === 'folder') return 1
                return b.updatedAt - a.updatedAt
            })
    })()

    async function createNote() {
        if (isTrash) return
        const all = getItems()
        const newNote = { id: crypto.randomUUID(), type: 'note', parentId: currentFolderId, content: '<div><br></div>', updatedAt: Date.now(), isTrashed: false }
        all.push(newNote)
        saveLocal(all)
        await db.pushItem(newNote)
        navigate(`/note/${newNote.id}`)
    }

    function openFolderModal() {
        if (isTrash) return
        setModalState({ open: true, mode: 'create', targetId: null, defaultValue: '' })
    }

    function handleModalSubmit(name) {
        const all = getItems()
        if (modalState.mode === 'create') {
            const newFolder = { id: crypto.randomUUID(), type: 'folder', parentId: currentFolderId, name, updatedAt: Date.now(), isTrashed: false }
            all.push(newFolder)
            saveLocal(all)
            db.pushItem(newFolder)
        } else if (modalState.mode === 'rename') {
            const idx = all.findIndex(i => i.id === modalState.targetId)
            if (idx > -1) { all[idx].name = name; all[idx].updatedAt = Date.now(); db.pushItem(all[idx]) }
            saveLocal(all)
        }
        refresh()
    }

    function deleteItem(e, itemId) {
        e.preventDefault(); e.stopPropagation()
        const all = getItems()
        const idx = all.findIndex(i => i.id === itemId)
        if (idx === -1) return
        if (all[idx].isTrashed) {
            if (!confirm('Permanently delete this?')) return
            all.splice(idx, 1)
            saveLocal(all)
            db.deleteItem(itemId)
        } else {
            all[idx].isTrashed = true
            all[idx].trashedAt = Date.now()
            saveLocal(all)
            db.pushItem(all[idx])
        }
        refresh()
    }

    function restoreItem(e, itemId) {
        e.preventDefault(); e.stopPropagation()
        const all = getItems()
        const idx = all.findIndex(i => i.id === itemId)
        if (idx > -1) {
            all[idx].isTrashed = false
            delete all[idx].trashedAt
            saveLocal(all)
            db.pushItem(all[idx])
            refresh()
        }
    }

    function renameItem(e, itemId, currentName) {
        e.preventDefault(); e.stopPropagation()
        setModalState({ open: true, mode: 'rename', targetId: itemId, defaultValue: currentName })
    }

    return (
        <>
            <Layout
                currentFolderId={currentFolderId}
                onNavigate={navigateTo}
                onCreateNote={createNote}
                onOpenFolderModal={openFolderModal}
                isTrash={isTrash}
                breadcrumbs={breadcrumbs}
            >
                {/* Notes grid/list */}
                <div className={`notes-container ${viewMode} pb-20 md:pb-0`}>
                    {visibleItems.length === 0 ? (
                        <div className="col-span-full text-center mt-12" style={{ color: 'var(--text-muted)' }}>
                            {isTrash ? 'Trash is empty' : 'Empty — create a note or folder to get started'}
                        </div>
                    ) : (
                        visibleItems.map(item => (
                            item.type === 'folder'
                                ? <FolderCard
                                    key={item.id}
                                    item={item}
                                    isTrash={isTrash}
                                    onNavigate={navigateTo}
                                    onDelete={deleteItem}
                                    onRestore={restoreItem}
                                    onRename={renameItem}
                                />
                                : <NoteCard
                                    key={item.id}
                                    item={item}
                                    isTrash={isTrash}
                                    onDelete={deleteItem}
                                    onRestore={restoreItem}
                                />
                        ))
                    )}
                </div>
            </Layout>

            <Modal
                isOpen={modalState.open}
                title={modalState.mode === 'create' ? 'New Folder' : 'Rename Folder'}
                placeholder="Enter folder name..."
                defaultValue={modalState.defaultValue}
                onClose={() => setModalState(s => ({ ...s, open: false }))}
                onSubmit={handleModalSubmit}
            />
        </>
    )
}

function NoteCard({ item, isTrash, onDelete, onRestore }) {
    const navigate = useNavigate()
    const lines = parseNoteContent(item.content)
    const title = lines.length > 0 ? lines[0] : 'Untitled Note'
    const preview = lines.length > 1 ? lines.slice(1).join(' ') : ''

    return (
        <div
            className={`card-base note-card group${isTrash ? ' opacity-60' : ''}`}
            onClick={isTrash ? undefined : () => navigate(`/note/${item.id}`)}
        >
            <div className="note-content-wrapper">
                <h3>{title}</h3>
                <p>{preview}</p>
            </div>
            <div className="card-date">{formatDate(item.updatedAt)}</div>
            <div className="card-actions">
                {isTrash ? (
                    <>
                        <button onClick={(e) => onRestore(e, item.id)} className="icon-btn btn-restore" title="Restore">
                            <CornerUpLeft className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Delete Forever">
                            <X className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Move to Trash">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    )
}

function FolderCard({ item, isTrash, onNavigate, onDelete, onRestore, onRename }) {
    return (
        <div
            className={`card-base folder-card group${isTrash ? ' opacity-60' : ''}`}
            onClick={isTrash ? undefined : () => onNavigate(item.id)}
        >
            <div className="flex items-center gap-2 flex-grow truncate pointer-events-none">
                <Folder className="w-5 h-5 flex-shrink-0" fill="currentColor" style={{ color: 'var(--accent-icon)' }} />
                <span className="font-medium truncate">{item.name}</span>
            </div>
            <div className="card-actions">
                {isTrash ? (
                    <>
                        <button onClick={(e) => onRestore(e, item.id)} className="icon-btn btn-restore" title="Restore">
                            <CornerUpLeft className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Delete Forever">
                            <X className="w-4 h-4" />
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={(e) => onRename(e, item.id, item.name)} className="icon-btn btn-edit" title="Rename">
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Move to Trash">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
