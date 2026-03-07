import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchModal from './SearchModal'
import Modal from './Modal'
import { calculateStreak } from '../hooks/useStats'
import { db } from '../lib/db'
import { Home, Search, Trash2, CircleUser, Plus, Menu, ArrowLeft, FilePlus, FolderPlus, User, ChevronRight, Flame } from 'lucide-react'

// Icons
const HomeIcon = () => <Home className="w-6 h-6" />
const SearchIcon = () => <Search size={20} />
const TrashIcon = () => <Trash2 size={20} />
const ProfileIcon = () => <CircleUser size={22} />
const PlusIcon = () => <Plus className="w-6 h-6" />
const MenuIcon = () => <Menu className="w-6 h-6" />

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

                    {/* Sticky Header */}
                    <div className="app-header">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 min-w-0">
                                {isTrash && (
                                    <button
                                        onClick={() => onNavigate('root')}
                                        className="p-1.5 -ml-1.5 rounded-lg transition-all cursor-pointer hover:bg-neutral-500/10"
                                        style={{ color: 'var(--text-muted)' }}
                                        title="Back to Home"
                                    >
                                        <ArrowLeft size={18} className="pointer-events-none" />
                                    </button>
                                )}
                                <h1
                                    onClick={() => onNavigate('root')}
                                    className="text-xl md:text-2xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ color: 'var(--text-main)' }}
                                >
                                    <span className="logo-accent">Brain</span>Log
                                </h1>
                                {/* Breadcrumbs */}
                                {breadcrumbs.length > 1 && (
                                    <div className="hidden md:flex items-center text-xs ml-2 overflow-x-auto whitespace-nowrap scrollbar-hide mask-linear-right" style={{ color: 'var(--text-muted)' }}>
                                        <span className="mx-1.5" style={{ opacity: 0.4 }}>›</span>
                                        {breadcrumbs.slice(1).map((crumb, index) => {
                                            const isLast = index === breadcrumbs.slice(1).length - 1
                                            return (
                                                <span key={crumb.id} className="flex items-center">
                                                    <span
                                                        className={`breadcrumb-item${isLast ? ' active' : ''}`}
                                                        onClick={isLast ? undefined : () => onNavigate(crumb.id)}
                                                    >
                                                        {crumb.name}
                                                    </span>
                                                    {!isLast && <span className="breadcrumb-separator">›</span>}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Desktop toolbar */}
                            <div className="hidden md:flex gap-1 items-center flex-shrink-0">
                                <button onClick={() => setSearchOpen(true)} className="view-btn" title="Search (Ctrl+K)">
                                    <SearchIcon />
                                </button>
                                <button onClick={() => navigate('/stats')} className="view-btn gap-1 font-semibold px-2" title="Writing Stats">
                                    <Flame size={18} className={streak > 0 ? 'text-orange-500' : ''} style={streak === 0 ? { color: 'var(--text-muted)', opacity: 0.5 } : undefined} />
                                    <span className={`text-sm ${streak > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`} style={streak === 0 ? { color: 'var(--text-muted)' } : undefined}>{streak}</span>
                                </button>
                                <button
                                    onClick={() => isTrash ? onNavigate('root') : onNavigate('trash')}
                                    className={`trash-btn${isTrash ? ' active' : ''}`}
                                    title="Trash"
                                >
                                    <TrashIcon />
                                </button>
                                <button onClick={() => navigate('/settings')} className="profile-btn w-10 h-10" title="Settings">
                                    <ProfileIcon />
                                </button>
                            </div>
                        </div>
                        {/* Mobile breadcrumbs */}
                        {breadcrumbs.length > 1 && (
                            <div className="md:hidden flex items-center text-xs mt-1 overflow-x-auto whitespace-nowrap scrollbar-hide mask-linear-right" style={{ color: 'var(--text-muted)' }}>
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
                                            {!isLast && <span className="breadcrumb-separator">›</span>}
                                        </span>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Desktop action bar */}
                    {!isTrash && (
                        <div className="hidden md:flex gap-4 mb-6">
                            <div onClick={onCreateNote} className="action-btn hover:border-solid hover:bg-card">
                                <FilePlus className="w-5 h-5" />
                                <span className="text-sm font-medium">New Note</span>
                            </div>
                            <div onClick={onOpenFolderModal} className="action-btn hover:border-solid hover:bg-card">
                                <FolderPlus className="w-5 h-5" />
                                <span className="text-sm font-medium">New Folder</span>
                            </div>
                        </div>
                    )}

                    {/* Page content */}
                    {children}
                </div>
            </div >

            {/* Mobile bottom nav */}
            < nav
                className="md:hidden fixed bottom-0 left-0 w-full z-40 safe-area-pb"
                style={{ height: 60, backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)' }
                }
            >
                <div className="flex items-center justify-between h-full px-6">
                    <button onClick={() => onNavigate('root')} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <HomeIcon />
                    </button>
                    <button onClick={() => navigate('/stats')} className="flex items-center gap-1.5 p-2 active:scale-90 transition-transform">
                        <span className="text-lg" style={streak === 0 ? { filter: 'grayscale(1)', opacity: 0.5 } : undefined}>🔥</span>
                        <span className={`font-bold text-sm ${streak > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`} style={streak === 0 ? { color: 'var(--text-muted)' } : undefined}>{streak}</span>
                    </button>
                    <button onClick={() => setSearchOpen(true)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <SearchIcon />
                    </button>
                    <button onClick={() => setDrawerOpen(true)} className="p-2 active:scale-90 transition-transform" style={{ color: 'var(--text-muted)' }}>
                        <MenuIcon />
                    </button>
                </div>
            </nav >

            {/* Mobile FAB menu items */}
            < div
                className={`md:hidden fixed bottom-40 right-6 flex flex-col items-end gap-4 z-50 pointer-events-none transition-all duration-200 mb-safe ${fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
                <button
                    onClick={() => { onOpenFolderModal(); setFabOpen(false) }}
                    className="flex items-center gap-3 pointer-events-auto"
                >
                    <span className="text-xs font-bold px-2 py-1.5 rounded-md shadow-md" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>New Folder</span>
                    <div className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                        <FolderPlus className="w-6 h-6" />
                    </div>
                </button>
                <button
                    onClick={() => { onCreateNote(); setFabOpen(false) }}
                    className="flex items-center gap-3 pointer-events-auto"
                >
                    <span className="text-xs font-bold px-2 py-1.5 rounded-md shadow-md" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>New Note</span>
                    <div className="w-12 h-12 rounded-full shadow-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                        <FilePlus className="w-6 h-6" />
                    </div>
                </button>
            </div >

            {/* Mobile FAB button */}
            < button
                onClick={(e) => { e.stopPropagation(); setFabOpen(!fabOpen) }}
                className="md:hidden fixed bottom-20 right-6 w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-95 transition-all duration-300 mb-safe bg-black dark:bg-white dark:text-black"
            >
                <span className={`block transition-transform duration-300 ${fabOpen ? 'rotate-45' : ''}`}>
                    <PlusIcon />
                </span>
            </button >

            {/* Mobile drawer overlay */}
            {
                drawerOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
                        onClick={() => setDrawerOpen(false)}
                    />
                )
            }

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
                            <User className="w-6 h-6" />
                        </div>
                        <div className="flex-grow">
                            <div className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Profile & Settings</div>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Manage account and theme</div>
                        </div>
                        <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    </button>

                    <button
                        onClick={() => { isTrash ? onNavigate('root') : onNavigate('trash'); setDrawerOpen(false) }}
                        className="flex items-center gap-4 p-4 hover:bg-neutral-500/5 rounded-xl transition-colors w-full text-left text-red-500 cursor-pointer"
                    >
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="font-medium text-lg flex-grow">Trash Directory</div>
                    </button>
                </div>
            </div>
        </>
    )
}
