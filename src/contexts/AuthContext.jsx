import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Initial setup only fetches session to unblock UI render
        auth.getUser().then((u) => {
            setUser(u)
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
                localStorage.removeItem('elegant_writer_notes')
                window.dispatchEvent(new Event('notes-synced')) // Clear UI
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    return (
        <AuthContext.Provider value={{ user, isLoading, setUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
