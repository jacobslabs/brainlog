import { supabase } from './supabase'

export const auth = {
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
        const { data } = await supabase.auth.getUser()
        return data.user
    },
    async getSession() {
        const { data } = await supabase.auth.getSession()
        return data.session
    },
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback)
    }
}
