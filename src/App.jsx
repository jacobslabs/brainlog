import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import HomePage from './pages/HomePage'

const EditorPage = lazy(() => import('./pages/EditorPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Suspense fallback={null}>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/note/:id" element={<EditorPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/stats" element={<StatsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    )
}
