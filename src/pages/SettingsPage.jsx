import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()
    const { user, isLoading: userLoading } = useAuth()
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('elegant_writer_view_pref') || 'grid')
    const [dailyGoal, setDailyGoal] = useState(() => localStorage.getItem('brainlog_daily_goal') || '0')
    const [loggingOut, setLoggingOut] = useState(false)

    function handleThemeChange(e) {
        setTheme(e.target.value)
        db.updateProfile()
    }

    function handleViewChange(e) {
        const v = e.target.value
        setViewMode(v)
        localStorage.setItem('elegant_writer_view_pref', v)
        db.updateProfile()
    }

    function handleGoalChange(e) {
        const v = e.target.value
        setDailyGoal(v)
        localStorage.setItem('brainlog_daily_goal', parseInt(v) || 0)
        db.updateProfile()
    }

    function exportData() {
        const data = localStorage.getItem('elegant_writer_notes')
        const blob = new Blob([data || '[]'], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `brainlog-backup-${Date.now()}.json`; a.click()
        URL.revokeObjectURL(url)
    }

    async function handleLogout() {
        setLoggingOut(true)
        await db.logout()
        navigate('/login')
    }

    return (
        <div
            className="flex flex-col items-center min-h-screen pb-24 md:pb-12 md:p-12"
            style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
        >
            <div className="w-full max-w-5xl px-4 pt-4 md:px-0 md:pt-0">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full transition-all cursor-pointer hover:bg-neutral-500/10"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                </div>

                {/* Appearance */}
                <SectionLabel>Appearance</SectionLabel>
                <div className="setting-group">
                    <div className="setting-item">
                        <SettingInfo title="Theme" desc="Choose your interface style." />
                        <select id="theme-selector" value={theme} onChange={handleThemeChange} className="form-select">
                            <option value="system">System Default</option>
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <SettingInfo title="Layout View" desc="Choose how notes are displayed." />
                        <select id="view-selector" value={viewMode} onChange={handleViewChange} className="form-select">
                            <option value="grid">Grid</option>
                            <option value="list">List</option>
                        </select>
                    </div>
                </div>

                {/* Goals */}
                <SectionLabel className="mt-6">Goals</SectionLabel>
                <div className="setting-group">
                    <div className="setting-item">
                        <SettingInfo title="Daily Word Target" desc="Set to 0 to disable tracking." />
                        <div className="flex items-center gap-2">
                            <input
                                id="goal-input"
                                type="number"
                                min="0"
                                step="50"
                                value={dailyGoal}
                                onChange={handleGoalChange}
                                className="form-input w-20 text-right"
                                placeholder="0"
                            />
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>words</span>
                        </div>
                    </div>
                </div>

                {/* Activity */}
                <SectionLabel className="mt-6">Activity</SectionLabel>
                <div className="setting-group">
                    <button onClick={() => navigate('/stats')} className="setting-item hover:bg-neutral-500/5 transition-colors cursor-pointer w-full text-left">
                        <SettingInfo title="Writing Statistics" desc="View word counts and typing speed." />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: 'var(--text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Data */}
                <SectionLabel className="mt-6">Data Management</SectionLabel>
                <div className="setting-group">
                    <div className="setting-item">
                        <SettingInfo title="Export Local Data" desc="Download a JSON backup of your notes." />
                        <button id="btn-export" onClick={exportData} className="btn-secondary">Export JSON</button>
                    </div>
                </div>

                {/* Account */}
                <SectionLabel className="mt-6">Account</SectionLabel>
                <div className="setting-group" id="account-section">
                    {userLoading ? (
                        <div className="p-4 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                    ) : user ? (
                        <>
                            <div className="setting-item">
                                <SettingInfo title="Email Address" desc={user.email} />
                            </div>
                            <div className="setting-item">
                                <SettingInfo title="Cloud Sync" desc="Your notes are backed up to Cloud." />
                                <div className="flex items-center gap-2 text-green-500 text-xs font-medium">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                                    </span>
                                    Active
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="setting-item">
                            <SettingInfo title="Guest Mode" desc="Notes are stored locally on this device." />
                            <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-muted)' }}>Local Only</div>
                        </div>
                    )}
                </div>

                {/* Action (logout / login) */}
                <div className="setting-group mt-0" id="action-section" style={{ borderColor: user ? 'rgba(248, 113, 113, 0.3)' : 'rgba(59, 130, 246, 0.3)' }}>
                    {user ? (
                        <button
                            id="btn-logout"
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="setting-item hover:bg-red-500/5 transition-colors cursor-pointer w-full text-left"
                        >
                            {loggingOut ? (
                                <div className="flex items-center gap-2 text-red-500 w-full justify-center py-2">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span className="text-sm font-medium">Syncing & Logging out...</span>
                                </div>
                            ) : (
                                <>
                                    <SettingInfo title={<span className="text-red-400">Log Out</span>} desc="Sign out of this device." />
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                    </svg>
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="setting-item hover:bg-blue-500/5 transition-colors cursor-pointer w-full text-left"
                        >
                            <SettingInfo title={<span className="text-blue-500">Log In / Sign Up</span>} desc="Sync your notes across devices." />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function SectionLabel({ children, className = '' }) {
    return (
        <h2
            className={`text-xs font-semibold uppercase tracking-wider mb-2 ml-1 ${className}`}
            style={{ color: 'var(--text-muted)' }}
        >
            {children}
        </h2>
    )
}

function SettingInfo({ title, desc }) {
    return (
        <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{title}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
        </div>
    )
}
