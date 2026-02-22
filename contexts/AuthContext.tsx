"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    User,
    signInAnonymously,
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    signInWithPopup,
    linkWithPopup
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginAnonymously: () => Promise<void>;
    loginWithGoogle: () => Promise<any>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loginAnonymously = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Error signing in anonymously:", error);
        }
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
            // Force select account to guarantee we get a fresh token with scopes if needed
            provider.setCustomParameters({
                prompt: 'select_account'
            });

            if (auth.currentUser && auth.currentUser.isAnonymous) {
                // Link anonymous account with Google
                const credential = await linkWithPopup(auth.currentUser, provider);
                return credential;
            } else {
                // Initial login with Google
                const credential = await signInWithPopup(auth, provider);
                return credential;
            }
        } catch (error) {
            console.error("Error signing in with Google:", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginAnonymously, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
