// Auth Modal Component - Sign In / Sign Up with Supabase

import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { X, Mail, Lock, User, Loader2, Chrome } from 'lucide-react';

export function AuthModal({ isOpen, onClose, initialMode = 'signin' }) {
    const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
    const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            if (mode === 'signin') {
                const { error } = await signIn(email, password);
                if (error) throw error;
                onClose();
            } else if (mode === 'signup') {
                const { error } = await signUp(email, password);
                if (error) throw error;
                setMessage('Check your email for the confirmation link!');
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) throw error;
                setMessage('Password reset link sent to your email!');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const { error } = await signInWithGoogle();
            if (error) throw error;
        } catch (err) {
            setError(err.message || 'Google sign-in failed');
            setLoading(false);
        }
    };

    return (
        <div
            className="auth-modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease'
            }}
        >
            <div
                className="auth-modal"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '2.5rem',
                    width: '100%',
                    maxWidth: '420px',
                    position: 'relative',
                    animation: 'scaleIn 0.2s ease'
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.5rem'
                    }}
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <h2 style={{
                    marginBottom: '0.5rem',
                    fontSize: '1.75rem',
                    fontWeight: 600,
                    textAlign: 'center'
                }}>
                    {mode === 'signin' && 'Welcome Back'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Reset Password'}
                </h2>
                <p style={{
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginBottom: '2rem',
                    fontSize: '0.9rem'
                }}>
                    {mode === 'signin' && 'Sign in to access your dashboard'}
                    {mode === 'signup' && 'Start your free trial today'}
                    {mode === 'forgot' && 'Enter your email to reset password'}
                </p>

                {/* Error/Success Messages */}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem'
                    }}>
                        {error}
                    </div>
                )}
                {message && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        color: '#4ade80',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem'
                    }}>
                        {message}
                    </div>
                )}

                {/* Google Sign In */}
                {mode !== 'forgot' && (
                    <>
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '0.95rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                            onMouseOut={e => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                        >
                            <Chrome size={20} />
                            Continue with Google
                        </button>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            margin: '1.5rem 0',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem'
                        }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                            or continue with email
                            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                        </div>
                    </>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)'
                            }}>
                                Name
                            </label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Your name"
                                    className="hud-input"
                                    style={{ paddingLeft: '3rem', width: '100%' }}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                        }}>
                            Email
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{
                                position: 'absolute',
                                left: '1rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)'
                            }} />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="hud-input"
                                style={{ paddingLeft: '3rem', width: '100%' }}
                            />
                        </div>
                    </div>

                    {mode !== 'forgot' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)'
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="hud-input"
                                    style={{ paddingLeft: '3rem', width: '100%' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Forgot Password Link */}
                    {mode === 'signin' && (
                        <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setMode('forgot')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--neon-cyan)',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="hud-btn primary"
                        style={{
                            width: '100%',
                            padding: '0.875rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {loading && <Loader2 size={18} className="spin" />}
                        {mode === 'signin' && (loading ? 'Signing in...' : 'Sign In')}
                        {mode === 'signup' && (loading ? 'Creating account...' : 'Create Account')}
                        {mode === 'forgot' && (loading ? 'Sending...' : 'Send Reset Link')}
                    </button>
                </form>

                {/* Toggle Mode */}
                <div style={{
                    marginTop: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)'
                }}>
                    {mode === 'signin' && (
                        <>
                            Don't have an account?{' '}
                            <button
                                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                                style={{ background: 'none', border: 'none', color: 'var(--neon-primary)', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Sign up
                            </button>
                        </>
                    )}
                    {mode === 'signup' && (
                        <>
                            Already have an account?{' '}
                            <button
                                onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                                style={{ background: 'none', border: 'none', color: 'var(--neon-primary)', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Sign in
                            </button>
                        </>
                    )}
                    {mode === 'forgot' && (
                        <button
                            onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                            style={{ background: 'none', border: 'none', color: 'var(--neon-primary)', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Back to sign in
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AuthModal;
