import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Initial setup
        auth.getUser().then(async (u) => {
            setUser(u)
            if (u) {
                try {
                    await db.sync()
                } catch (e) {
                    console.log('Sync error (offline?):', e)
                }
            }
            setIsLoading(false)
        })

        // Listen for all auth events (LOGIN, LOGOUT, etc)
        const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user || null
            setUser(currentUser)

            if (event === 'SIGNED_IN' && currentUser) {
                try {
                    await db.sync()
                } catch (e) {
                    console.log('Sync error (offline?):', e)
                }
            } else if (event === 'SIGNED_OUT') {
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
