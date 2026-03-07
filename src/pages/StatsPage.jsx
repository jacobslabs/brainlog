import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateStreak, getStats } from '../hooks/useStats'

export default function StatsPage() {
    const navigate = useNavigate()
    const [stats, setStats] = useState({ daily: {}, totalWords: 0, wpmAvg: 0 })
    const [streak, setStreak] = useState(0)
    const [todayWords, setTodayWords] = useState(0)

    useEffect(() => {
        const s = getStats()
        setStats(s)
        setStreak(calculateStreak())
        const today = new Date().toISOString().split('T')[0]
        setTodayWords(s.daily?.[today] || 0)
    }, [])

    function clearStats() {
        if (confirm('Are you sure you want to reset all tracking stats? This cannot be undone.')) {
            localStorage.removeItem('brainlog_stats')
            setStats({ daily: {}, totalWords: 0, wpmAvg: 0 })
            setStreak(0)
            setTodayWords(0)
        }
    }

    // Generate heatmap dates (last 365 days)
    const heatmapDates = (() => {
        const dates = []
        const today = new Date()
        for (let i = 365; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(today.getDate() - i)
            dates.push(d)
        }
        return dates
    })()

    function getDayLevel(count) {
        if (count === 0) return ''
        if (count > 1000) return 'level-4'
        if (count > 500) return 'level-3'
        if (count > 200) return 'level-2'
        return 'level-1'
    }

    // Month labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthLabels = Array.from({ length: 12 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (11 - i))
        return monthNames[d.getMonth()]
    })

    const statCards = [
        { label: 'Today', value: todayWords, unit: 'Words', color: 'var(--text-main)' },
        { label: 'Current Streak', value: streak + (streak === 1 ? ' day' : ' days'), color: streak > 0 ? '#f97316' : 'var(--text-muted)' },
        { label: 'Total Words', value: stats.totalWords || 0, color: 'var(--text-main)' },
        { label: 'Avg Speed', value: Math.round(stats.wpmAvg || 0), unit: 'WPM', color: 'var(--accent-icon)' },
    ]

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
                        title="Back"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold tracking-tight">Writing Activity</h1>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {statCards.map(card => (
                        <div key={card.label} className="card-base p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                            <span className="text-3xl font-bold mt-1" style={{ color: card.color }}>{card.value}</span>
                            {card.unit && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.unit}</span>}
                        </div>
                    ))}
                </div>

                {/* Heatmap */}
                <div className="card-base p-6 mb-8">
                    <h2 className="text-sm font-semibold mb-6">Contribution History</h2>
                    <div className="w-full overflow-x-auto pb-2">
                        <div className="graph-wrapper">
                            {/* Month labels */}
                            <div className="months-row">
                                {monthLabels.map((m, i) => (
                                    <div key={i} className="month-label">{m}</div>
                                ))}
                            </div>
                            {/* Day squares */}
                            <div className="heatmap-container">
                                {heatmapDates.map((date, i) => {
                                    const key = date.toISOString().split('T')[0]
                                    const count = stats.daily?.[key] || 0
                                    const level = getDayLevel(count)
                                    return (
                                        <div
                                            key={i}
                                            className={`day-sq${level ? ' ' + level : ''}`}
                                            title={`${date.toDateString()}: ${count} words`}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-2 mt-4 text-xs justify-end" style={{ color: 'var(--text-muted)' }}>
                        <span>Less</span>
                        {['', 'level-1', 'level-2', 'level-3', 'level-4'].map((l, i) => (
                            <div key={i} className={`day-sq${l ? ' ' + l : ''}`} style={{ width: 10, height: 10 }} />
                        ))}
                        <span>More</span>
                    </div>
                </div>

                {/* Danger zone */}
                <div className="card-base p-6" style={{ borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                    <h2 className="text-sm font-semibold mb-2 text-red-500">Danger Zone</h2>
                    <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>This will permanently delete your writing history and streaks. Your notes will remain safe.</p>
                    <button
                        onClick={clearStats}
                        className="px-4 py-2 text-sm rounded transition-colors text-red-500 cursor-pointer"
                        style={{ border: '1px solid rgba(248, 113, 113, 0.4)' }}
                    >
                        Reset Statistics
                    </button>
                </div>
            </div>
        </div>
    )
}
