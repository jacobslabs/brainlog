import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchModal from './SearchModal'
import Modal from './Modal'
import { calculateStreak } from '../hooks/useStats'
import { db } from '../lib/db'

// Icons
const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
)
const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
)
const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
)
const ProfileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
)
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
)
const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
)

export default function Layout({
    children,
    currentFolderId,
    onNavigate,
    onCreateNote,
    onOpenFolderModal,
    isTrash,
    breadcrumbs,
}) {
    const navigate = useNavigate()
    const [searchOpen, setSearchOpen] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [fabOpen, setFabOpen] = useState(false)
    const [streak, setStreak] = useState(0)

    useEffect(() => {
        setStreak(calculateStreak())
    }, [])

    // Ctrl+K global shortcut
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [])

    // Close FAB when clicking outside
    useEffect(() => {
        if (!fabOpen) return
        const handler = () => setFabOpen(false)
        document.addEventListener('click', handler)
        return () => document.removeEventListener('click', handler)
    }, [fabOpen])

    return (
        <>
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            <div className="flex flex-col items-center min-h-screen overflow-x-hidden pb-24 md:pb-12 md:p-12" style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}>
                <div className="w-full max-w-5xl px-4 pt-4 md:px-0 md:pt-0">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div className="flex-grow min-w-0 w-full text-center md:text-left md:pr-4">
                            <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2">
                                {isTrash && (
                                    <button
                                        onClick={() => onNavigate('root')}
                                        className="p-2 -ml-2 md:-ml-4 rounded-full transition-all cursor-pointer hover:bg-neutral-500/10"
                                        style={{ color: 'var(--text-muted)' }}
                                        title="Back to Home"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                        </svg>
                                    </button>
                                )}
                                <h1
                                    onClick={() => onNavigate('root')}
                                    className="text-2xl md:text-3xl font-bold tracking-tight cursor-pointer hover:opacity-80"
                                    style={{ color: 'var(--text-main)' }}
                                >
                                    BrainLog
                                </h1>
                            </div>
                            {/* Breadcrumbs */}
                            <div className="overflow-x-auto whitespace-nowrap scrollbar-hide w-full mask-linear-right">
                                <div className="flex items-center justify-center md:justify-start text-sm mt-2 pb-1">
                                    {breadcrumbs.map((crumb, index) => {
                                        const isLast = index === breadcrumbs.length - 1
                                        return (
                                            <span key={crumb.id} className="flex items-center">
                                                <span
                                                    className={`breadcrumb-item${isLast ? ' active' : ''}`}
                                                    onClick={isLast ? undefined : () => onNavigate(crumb.id)}
                                                >
                                                    {crumb.name}
                                                </span>
                                                {!isLast && <span className="breadcrumb-separator">/</span>}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Desktop toolbar */}
                        <div className="hidden md:flex gap-2 items-center flex-shrink-0">
                            <button onClick={() => setSearchOpen(true)} className="view-btn" title="Search (Ctrl+K)">
                                <SearchIcon />
                            </button>
                            <button onClick={() => navigate('/stats')} className="view-btn gap-1 font-semibold px-3" title="Writing Stats">
                                <span>🔥</span>
                                <span className="text-orange-600 dark:text-orange-400">{streak}</span>
                            </button>
                            <button
                                onClick={() => isTrash ? onNavigate('root') : onNavigate('trash')}
                                className={`trash-btn${isTrash ? ' active' : ''}`}
                                title="Trash"
                            >
                                <TrashIcon />
                            </button>
                            <button onClick={() => navigate('/settings')} className="profile-btn w-11 h-11" title="Settings">
                                <ProfileIcon />
                            </button>
                        </div>
                    </div>

                    {/* Desktop action bar */}
                    {!isTrash && (
                        <div className="hidden md:flex gap-4 mb-6">
                            <div onClick={onCreateNote} className="action-btn hover:border-solid hover:bg-card">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                <span className="text-sm font-medium">New Note</span>
                            </div>
                            <div onClick={onOpenFolderModal} className="action-btn hover:border-solid hover:bg-card">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                </svg>
                                <span className="text-sm font-medium">New Folder</span>
                            </div>
                        </div>
                    )}

                    {/* Page content */}
                    {children}
                </div>
            </div>

            {/* Mobile bottom nav */}
            <nav
                className="md:hidden fixed bottom-0 left-0 w-full z-40 safe-area-pb"
                style={{ height: 60, backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)' }}
            >
                <div className="flex items-center justify-between h-full px-6">
                    <button onClick={() => onNavigate('root')} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <HomeIcon />
                    </button>
                    <button onClick={() => navigate('/stats')} className="flex items-center gap-1.5 p-2 active:scale-90 transition-transform">
                        <span className="text-lg">🔥</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{streak}</span>
                    </button>
                    <button onClick={() => setSearchOpen(true)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <SearchIcon />
                    </button>
                    <button onClick={() => setDrawerOpen(true)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <MenuIcon />
                    </button>
                </div>
            </nav>

            {/* Mobile FAB menu items */}
            <div
                className={`md:hidden fixed bottom-40 right-6 flex flex-col items-end gap-4 z-50 pointer-events-none transition-all duration-200 mb-safe ${fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
                <button
                    onClick={() => { onOpenFolderModal(); setFabOpen(false) }}
                    className="flex items-center gap-3 pointer-events-auto"
                >
                    <span className="text-xs font-bold px-2 py-1.5 rounded-md shadow-md" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>New Folder</span>
                    <div className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                </button>
                <button
                    onClick={() => { onCreateNote(); setFabOpen(false) }}
                    className="flex items-center gap-3 pointer-events-auto"
                >
                    <span className="text-xs font-bold px-2 py-1.5 rounded-md shadow-md" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>New Note</span>
                    <div className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                </button>
            </div>

            {/* Mobile FAB button */}
            <button
                onClick={(e) => { e.stopPropagation(); setFabOpen(!fabOpen) }}
                className="md:hidden fixed bottom-20 right-6 w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-95 transition-all duration-300 mb-safe bg-black dark:bg-white dark:text-black"
            >
                <span className={`block transition-transform duration-300 ${fabOpen ? 'rotate-45' : ''}`}>
                    <PlusIcon />
                </span>
            </button>

            {/* Mobile drawer overlay */}
            {drawerOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <div
                className={`fixed bottom-0 left-0 w-full rounded-t-2xl z-[70] transform transition-transform duration-300 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] pb-safe ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}
            >
                <div className="p-4 flex justify-center w-full" onClick={() => setDrawerOpen(false)}>
                    <div className="w-12 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                </div>
                <div className="px-4 pb-32 grid gap-2">
                    <button
                        onClick={() => { navigate('/settings'); setDrawerOpen(false) }}
                        className="flex items-center gap-4 p-4 hover:bg-neutral-500/5 rounded-xl transition-colors w-full text-left"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div className="flex-grow">
                            <div className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Profile & Settings</div>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage account and theme</div>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                    <button
                        onClick={() => { isTrash ? onNavigate('root') : onNavigate('trash'); setDrawerOpen(false) }}
                        className="flex items-center gap-4 p-4 hover:bg-neutral-500/5 rounded-xl transition-colors w-full text-left text-red-500 cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <div className="font-medium text-lg flex-grow">Trash Directory</div>
                    </button>
                </div>
            </div>
        </>
    )
}
