import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'

export default function LoginPage() {
    const navigate = useNavigate()
    const emailRef = useRef(null)
    const passRef = useRef(null)
    const [msg, setMsg] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleLogin() {
        setLoading(true)
        setMsg('Signing in...')
        const { error } = await auth.signIn(emailRef.current.value, passRef.current.value)
        if (error) { setMsg(error.message); setLoading(false) }
        else navigate('/')
    }

    async function handleSignup() {
        setLoading(true)
        setMsg('Creating account...')
        const { error } = await auth.signUp(emailRef.current.value, passRef.current.value)
        setLoading(false)
        if (error) setMsg(error.message)
        else setMsg('Check your email for the confirmation link!')
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter') handleLogin()
    }

    return (
        <div
            className="flex items-center justify-center min-h-screen p-4"
            style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)' }}
        >
            <div
                className="w-full max-w-md p-8 rounded-xl shadow-2xl"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="text-4xl mb-3">🧠</div>
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-main)' }}>BrainLog</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Your personal second brain</p>
                </div>

                <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    placeholder="Email"
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />
                <input
                    ref={passRef}
                    id="password"
                    type="password"
                    placeholder="Password"
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg p-3 mb-5 focus:outline-none focus:ring-2 focus:ring-neutral-400"
                    style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
                />

                <button
                    id="btn-login"
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full font-semibold p-3 rounded-lg mb-3 transition-all disabled:opacity-50 cursor-pointer bg-neutral-800 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-100"
                >
                    Sign In
                </button>
                <button
                    id="btn-signup"
                    onClick={handleSignup}
                    disabled={loading}
                    className="w-full font-semibold p-3 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                    style={{ border: '1px solid var(--border-color)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                >
                    Create Account
                </button>

                {msg && (
                    <p
                        className="text-center text-sm mt-4 min-h-[1.25rem]"
                        style={{ color: msg.includes('Check') ? '#22c55e' : '#ef4444' }}
                    >
                        {msg}
                    </p>
                )}

                <p
                    onClick={() => navigate('/')}
                    className="text-center text-xs mt-5 cursor-pointer transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Continue as Guest (Offline)
                </p>
            </div>
        </div>
    )
}
