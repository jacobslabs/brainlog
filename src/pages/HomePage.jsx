import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { db } from '../lib/db'
import { formatDate, parseNoteContent } from '../hooks/useNotes'

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
    const [currentView, setCurrentView] = useState(() => localStorage.getItem('elegant_writer_view_pref') || 'grid')
    const [modalState, setModalState] = useState({ open: false, mode: 'create', targetId: null, defaultValue: '' })

    const refresh = useCallback(() => setItems(getItems()), [])

    useEffect(() => {
        if (folderParam) setCurrentFolderId(folderParam)
        else setCurrentFolderId('root')
    }, [folderParam])

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

    function setView(v) {
        setCurrentView(v)
        localStorage.setItem('elegant_writer_view_pref', v)
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
                {/* View toggle (desktop) */}
                <div className="hidden md:flex justify-end mb-4 gap-2">
                    <button onClick={() => setView('grid')} className={`view-btn px-3 text-xs font-medium${currentView === 'grid' ? ' active' : ''}`}>Grid</button>
                    <button onClick={() => setView('list')} className={`view-btn px-3 text-xs font-medium${currentView === 'list' ? ' active' : ''}`}>List</button>
                </div>

                {/* Notes grid/list */}
                <div className={`notes-container ${currentView}-view pb-20 md:pb-0`}>
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
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Delete Forever">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </>
                ) : (
                    <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Move to Trash">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-icon)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <span className="font-medium truncate">{item.name}</span>
            </div>
            <div className="card-actions">
                {isTrash ? (
                    <>
                        <button onClick={(e) => onRestore(e, item.id)} className="icon-btn btn-restore" title="Restore">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Delete Forever">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={(e) => onRename(e, item.id, item.name)} className="icon-btn btn-edit" title="Rename">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                        </button>
                        <button onClick={(e) => onDelete(e, item.id)} className="icon-btn btn-delete" title="Move to Trash">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
