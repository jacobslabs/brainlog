import { createClient } from '@supabase/supabase-js'

const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
const STORAGE_KEY = 'elegant_writer_notes';

export const auth = {
    async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        return { data, error };
    },
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        return { data, error };
    },
    async signOut() {
        // Low-level sign out only. 
        // Data clearing is handled by db.logout() to ensure backups happen first.
        await supabase.auth.signOut();
    },
    async getUser() {
        const { data } = await supabase.auth.getUser();
        return data.user;
    }
};

export const db = {
    // 1. SYNC: Download Cloud Data -> Merge with Local
    async sync() {
        const user = await auth.getUser();
        if (!user) return; 

        // A. Sync Notes
        const { data: cloudNotes, error } = await supabase.from('notes').select('*');
        if (error) console.error("Notes Sync Error:", error);
        
        const localNotes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const mergedMap = new Map();
        
        // Load local notes first
        localNotes.forEach(n => mergedMap.set(n.id, n));

        // Merge cloud notes (winning if newer)
        if (cloudNotes) {
            cloudNotes.forEach(cloudNote => {
                const localNote = mergedMap.get(cloudNote.id);
                // Ensure we compare timestamps correctly (both as Date objects for comparison)
                const cloudTime = new Date(cloudNote.updated_at).getTime();
                const localTime = localNote ? new Date(localNote.updatedAt).getTime() : 0;

                // If cloud note is newer OR local note doesn't exist, use cloud
                if (!localNote || (cloudTime > localTime)) {
                    mergedMap.set(cloudNote.id, {
                        id: cloudNote.id,
                        type: cloudNote.type,
                        parentId: cloudNote.parent_id,
                        name: cloudNote.name,
                        content: cloudNote.content,
                        isTrashed: cloudNote.is_trashed,
                        updatedAt: cloudNote.updated_at // Store exactly what DB gave us
                    });
                }
            });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(mergedMap.values())));

        // B. Sync Profile (Theme, Goals, Stats)
        await this.syncProfile(user.id);
        
        return true;
    },

    // 2. PUSH: Single Item Upload
    async pushItem(item) { 
        const user = await auth.getUser();
        if (!user) return;
        
        const payload = {
            id: item.id, 
            user_id: user.id, 
            parent_id: item.parentId, 
            type: item.type,
            name: item.name, 
            content: item.content, 
            is_trashed: item.isTrashed,
            // FIX: Send raw number, NOT new Date()
            updated_at: item.updatedAt 
        };
        
        await supabase.from('notes').upsert(payload);
    },

    async deleteItem(itemId) { 
        await supabase.from('notes').delete().eq('id', itemId);
    },

    // 3. FORCE BACKUP: Upload EVERYTHING (Safety Valve)
    async uploadAll() {
        const user = await auth.getUser();
        if (!user) return;

        const localNotes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (localNotes.length === 0) return;

        console.log(`Backing up ${localNotes.length} items to cloud...`);

        // Convert ALL local items to DB format
        const payload = localNotes.map(n => ({
            id: n.id, 
            user_id: user.id, 
            parent_id: n.parentId, 
            type: n.type,
            name: n.name, 
            content: n.content, 
            is_trashed: n.isTrashed, 
            // FIX: Send raw number, NOT new Date()
            updated_at: n.updatedAt 
        }));

        const { error } = await supabase.from('notes').upsert(payload);
        
        if (error) console.error("Backup Error:", error);
        else console.log("Full Backup successful");
        
        // Also sync profile stats
        await this.updateProfile();
    },

    // 4. SAFE LOGOUT: Backup -> SignOut -> Wipe
    async logout() {
        // A. Force Backup of EVERYTHING first
        await this.uploadAll();
        
        // B. Sign out from Supabase
        await auth.signOut();
        
        // C. NOW it is safe to wipe local data
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('brainlog_stats');
        localStorage.removeItem('brainlog_daily_goal');
        
        // D. Redirect
        window.location.href = 'login.html';
    },

    // --- PROFILE & STATS ENGINE ---

    async syncProfile(userId) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { 
            console.error("Profile Fetch Error:", error);
            return;
        }

        if (data) {
            if(data.theme) localStorage.setItem('brainlog_theme', data.theme);
            if(data.view_mode) localStorage.setItem('elegant_writer_view_pref', data.view_mode);
            if(data.daily_goal) localStorage.setItem('brainlog_daily_goal', data.daily_goal);
            if(data.stats) localStorage.setItem('brainlog_stats', JSON.stringify(data.stats));
            
            const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = data.theme === 'system' ? (sys ? 'dark' : 'light') : data.theme;
            document.documentElement.setAttribute('data-theme', theme);
        } else {
            await this.updateProfile();
        }
    },

    async updateProfile() {
        const user = await auth.getUser();
        if (!user) return;

        const payload = {
            id: user.id,
            theme: localStorage.getItem('brainlog_theme') || 'system',
            view_mode: localStorage.getItem('elegant_writer_view_pref') || 'grid',
            daily_goal: parseInt(localStorage.getItem('brainlog_daily_goal') || 0),
            stats: JSON.parse(localStorage.getItem('brainlog_stats') || '{}'),
            updated_at: new Date() // Profiles table likely uses normal Timestamp, so this is fine
        };

        const { error } = await supabase.from('profiles').upsert(payload);
        if (error) console.error("Profile Push Error:", error);
    }
};