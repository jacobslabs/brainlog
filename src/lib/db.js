import { supabase } from './supabase'
import { auth } from './auth'
import { saveItemsCached, getItemsCached, invalidateCache } from '../hooks/useNotes'

export const db = {
    // 1. SYNC: Download Cloud Data -> Merge with Local
    async sync() {
        const user = auth.currentUser
        if (!user) return

        const { data: cloudNotes, error } = await supabase.from('notes').select('*')
        if (error) console.error('Notes Sync Error:', error)

        const localNotes = getItemsCached()
        const mergedMap = new Map()

        localNotes.forEach((n) => mergedMap.set(n.id, n))

        if (cloudNotes) {
            cloudNotes.forEach((cloudNote) => {
                const localNote = mergedMap.get(cloudNote.id)
                const cloudTime = new Date(cloudNote.updated_at).getTime()
                const localTime = localNote ? new Date(localNote.updatedAt).getTime() : 0

                if (!localNote || cloudTime > localTime) {
                    mergedMap.set(cloudNote.id, {
                        id: cloudNote.id,
                        type: cloudNote.type,
                        parentId: cloudNote.parent_id,
                        name: cloudNote.name,
                        content: cloudNote.content,
                        isTrashed: cloudNote.is_trashed,
                        updatedAt: cloudNote.updated_at,
                    })
                }
            })
        }

        saveItemsCached(Array.from(mergedMap.values()))

        await this.syncProfile(user.id)
        window.dispatchEvent(new Event('notes-synced'))
        return true
    },

    // 2. PUSH: Single Item Upload
    async pushItem(item) {
        const user = auth.currentUser
        if (!user) return

        const payload = {
            id: item.id,
            user_id: user.id,
            parent_id: item.parentId,
            type: item.type,
            name: item.name,
            content: item.content,
            is_trashed: item.isTrashed,
            updated_at: item.updatedAt,
        }

        await supabase.from('notes').upsert(payload)
    },

    async deleteItem(itemId) {
        await supabase.from('notes').delete().eq('id', itemId)
    },

    // 3. FORCE BACKUP: Upload EVERYTHING
    async uploadAll() {
        const user = auth.currentUser
        if (!user) return

        const localNotes = getItemsCached()
        if (localNotes.length === 0) return

        const payload = localNotes.map((n) => ({
            id: n.id,
            user_id: user.id,
            parent_id: n.parentId,
            type: n.type,
            name: n.name,
            content: n.content,
            is_trashed: n.isTrashed,
            updated_at: n.updatedAt,
        }))

        const { error } = await supabase.from('notes').upsert(payload)
        if (error) console.error('Backup Error:', error)

        await this.updateProfile()
    },

    // 4. SAFE LOGOUT: Backup -> SignOut -> Wipe
    async logout() {
        await this.uploadAll()
        await auth.signOut()
        invalidateCache()
        localStorage.removeItem('elegant_writer_notes')
        localStorage.removeItem('brainlog_stats')
        localStorage.removeItem('brainlog_daily_goal')
    },

    // --- PROFILE & STATS ENGINE ---

    async syncProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('Profile Fetch Error:', error)
            return
        }

        if (data) {
            if (data.theme) localStorage.setItem('brainlog_theme', data.theme)
            if (data.view_mode) localStorage.setItem('brainlog_view_mode', data.view_mode)
            if (data.daily_goal) localStorage.setItem('brainlog_daily_goal', data.daily_goal)
            if (data.stats) localStorage.setItem('brainlog_stats', JSON.stringify(data.stats))

            const sys = window.matchMedia('(prefers-color-scheme: dark)').matches
            const theme = data.theme === 'system' ? (sys ? 'dark' : 'light') : data.theme
            document.documentElement.setAttribute('data-theme', theme)
        } else {
            await this.updateProfile()
        }
    },

    async updateProfile() {
        const user = auth.currentUser
        if (!user) return

        const payload = {
            id: user.id,
            theme: localStorage.getItem('brainlog_theme') || 'system',
            view_mode: localStorage.getItem('brainlog_view_mode') || 'grid-view',
            daily_goal: parseInt(localStorage.getItem('brainlog_daily_goal') || 0),
            stats: JSON.parse(localStorage.getItem('brainlog_stats') || '{}'),
            updated_at: new Date(),
        }

        const { error } = await supabase.from('profiles').upsert(payload)
        if (error) console.error('Profile Push Error:', error)
    },
}
