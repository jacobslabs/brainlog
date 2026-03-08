import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { invalidateCache } from '../hooks/useNotes'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // 1. Fetch fast local session to unblock UI
        auth.getSession().then((session) => {
            setUser(session?.user || null)
            setIsLoading(false)
        })

        // Listen for all auth events (LOGIN, LOGOUT, etc)
        const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user || null
            setUser(currentUser)

            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (currentUser) {
                    try {
                        await db.sync()
                    } catch (e) {
                        console.log('Sync error (offline?):', e)
                    }
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                invalidateCache()
                localStorage.removeItem('elegant_writer_notes')
                window.dispatchEvent(new Event('notes-synced')) // Clear UI
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const value = useMemo(() => ({ user, isLoading, setUser }), [user, isLoading])

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
