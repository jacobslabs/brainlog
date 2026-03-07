import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
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
