"use client";

import React from 'react';
import { X, LogIn, Chrome } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { loginAnonymously } = useAuth();
    const { t } = useLanguage();

    if (!isOpen) return null;

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            onClose();
        } catch (error) {
            console.error("Google Login Error:", error);
        }
    };

    const handleAnonymousLogin = async () => {
        await loginAnonymously();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-[var(--color-neutral-100)] transition-colors"
                >
                    <X size={20} className="text-[var(--color-neutral-500)]" />
                </button>

                <div className="p-8 pt-12">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-[var(--color-primary-600)] text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
                            <LogIn size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-neutral-900)] mb-2">
                            Welcome to LifeLog AI
                        </h2>
                        <p className="text-[var(--color-neutral-600)]">
                            Sign in to save your diaries and sync across all devices.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            variant="primary"
                            size="lg"
                            fullWidth
                            className="flex items-center justify-center gap-3 h-14 text-base"
                            onClick={handleGoogleLogin}
                        >
                            <Chrome size={20} />
                            Continue with Google
                        </Button>

                        <div className="relative flex items-center justify-center py-2">
                            <div className="absolute inset-x-0 h-px bg-[var(--color-neutral-200)]" />
                            <span className="relative px-4 bg-white text-xs font-semibold text-[var(--color-neutral-400)] uppercase tracking-widest">
                                or
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            size="lg"
                            fullWidth
                            className="h-14 text-base"
                            onClick={handleAnonymousLogin}
                        >
                            Try for Free (Guest)
                        </Button>
                    </div>

                    <p className="mt-8 text-center text-xs text-[var(--color-neutral-400)] leading-relaxed px-4">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};
