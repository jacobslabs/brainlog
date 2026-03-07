import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        return localStorage.getItem('brainlog_theme') || 'system'
    })

    const applyTheme = useCallback((value) => {
        const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
        const resolved = value === 'system' ? (sys ? 'dark' : 'light') : value
        document.documentElement.setAttribute('data-theme', resolved)
    }, [])

    useEffect(() => {
        applyTheme(theme)
    }, [theme, applyTheme])

    // Listen for system theme changes
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = () => {
            if (theme === 'system') applyTheme('system')
        }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [theme, applyTheme])

    const setTheme = useCallback((value) => {
        localStorage.setItem('brainlog_theme', value)
        setThemeState(value)
        applyTheme(value)
    }, [applyTheme])

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}
