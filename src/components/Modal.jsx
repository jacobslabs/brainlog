import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, title, placeholder, onClose, onSubmit, defaultValue = '' }) {
    const inputRef = useRef(null)

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50)
            inputRef.current && (inputRef.current.value = defaultValue)
        }
    }, [isOpen, defaultValue])

    useEffect(() => {
        const handler = (e) => {
            if (!isOpen) return
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    })

    function handleSubmit() {
        const name = inputRef.current?.value.trim()
        if (!name) { onClose(); return }
        onSubmit(name)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm"
            style={{ backgroundColor: 'var(--modal-bg)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="border rounded-lg p-6 w-full max-w-sm shadow-2xl mx-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>{title}</h3>
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full border rounded p-3 focus:outline-none mb-6"
                    style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}
                    placeholder={placeholder || 'Enter name...'}
                    autoComplete="off"
                    defaultValue={defaultValue}
                />
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm cursor-pointer"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 text-sm rounded font-medium cursor-pointer bg-neutral-800 text-white hover:bg-black dark:bg-white dark:text-black"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    )
}
