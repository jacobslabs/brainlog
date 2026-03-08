import { supabase } from './supabase'

export const auth = {
    currentUser: null,
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        return { data, error }
    },
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        return { data, error }
    },
    async signOut() {
        await supabase.auth.signOut()
    },
    async getUser() {
        const { data, error } = await supabase.auth.getUser()
        if (error) console.error('Auth GetUser Error:', error)
        if (data?.user) auth.currentUser = data.user
        return data?.user || null
    },
    async getSession() {
        const { data, error } = await supabase.auth.getSession()
        if (error) console.error('Auth GetSession Error:', error)
        if (data?.session?.user) auth.currentUser = data.session.user
        return data?.session || null
    },
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
            auth.currentUser = session?.user || null
            callback(event, session)
        })
    }
}
