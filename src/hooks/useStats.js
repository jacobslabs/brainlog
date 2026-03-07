export function calculateStreak() {
    const stats = JSON.parse(localStorage.getItem('brainlog_stats') || '{"daily":{}}')
    const daily = stats.daily || {}
    const goal = parseInt(localStorage.getItem('brainlog_daily_goal') || 0)
    let streak = 0
    const toKey = (d) => d.toISOString().split('T')[0]
    let d = new Date()
    const checkSuccess = (count) => {
        if (count === undefined) return false
        return goal > 0 ? count >= goal : count > 0
    }
    if (checkSuccess(daily[toKey(d)])) streak++
    while (true) {
        d.setDate(d.getDate() - 1)
        if (checkSuccess(daily[toKey(d)])) streak++
        else break
    }
    return streak
}

export function getStats() {
    return JSON.parse(localStorage.getItem('brainlog_stats') || '{"daily":{},"totalWords":0,"wpmAvg":0}')
}

export function saveWordStats(delta) {
    const stats = getStats()
    const today = new Date().toISOString().split('T')[0]
    if (!stats.daily[today]) stats.daily[today] = 0
    stats.daily[today] += delta
    stats.totalWords = (stats.totalWords || 0) + delta
    localStorage.setItem('brainlog_stats', JSON.stringify(stats))
}

export function countWords(str) {
    const matches = str.match(/\b\w+\b/g)
    return matches ? matches.length : 0
}
