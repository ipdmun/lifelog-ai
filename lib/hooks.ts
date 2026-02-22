import { useState, useEffect, useRef, useCallback } from "react";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";

/**
 * useAuth Hook
 * Firebase authentication hook with anonymous sign-in
 */
export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setLoading(false);
            } else {
                signInAnonymously(auth)
                    .then((cred) => {
                        setUser(cred.user);
                        setLoading(false);
                    })
                    .catch((error) => {
                        console.error("Auth Error", error);
                        setLoading(false);
                    });
            }
        });

        return () => unsubscribe();
    }, []);

    return { user, loading };
}

/**
 * useMediaQuery Hook
 * Responsive logic hook for breakpoints
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);

        // Update initial state
        setMatches(media.matches);

        // Listen for changes
        const listener = (e: MediaQueryListEvent) => setMatches(e.matches);

        // Modern browsers
        if (media.addEventListener) {
            media.addEventListener('change', listener);
            return () => media.removeEventListener('change', listener);
        }
        // Older browsers
        else {
            media.addListener(listener);
            return () => media.removeListener(listener);
        }
    }, [query]);

    return matches;
}

/**
 * useKeyPress Hook
 * Keyboard shortcut hook
 *
 * @example
 * useKeyPress('Escape', () => closeModal());
 */
export function useKeyPress(
    targetKey: string,
    callback: () => void,
    options: { ctrl?: boolean; shift?: boolean; meta?: boolean } = {}
): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check modifier keys
            const ctrlMatch = options.ctrl ? e.ctrlKey : true;
            const shiftMatch = options.shift ? e.shiftKey : true;
            const metaMatch = options.meta ? e.metaKey : true;

            if (
                e.key === targetKey &&
                ctrlMatch &&
                shiftMatch &&
                metaMatch
            ) {
                e.preventDefault();
                callback();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [targetKey, callback, options]);
}

/**
 * useFocusTrap Hook
 * Trap focus within an element (for modals, drawers)
 *
 * @example
 * const modalRef = useFocusTrap<HTMLDivElement>(isOpen);
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
    const ref = useRef<T>(null);

    useEffect(() => {
        if (!active || !ref.current) return;

        const element = ref.current;
        const focusableElements = element.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus first element
        firstElement?.focus();

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement?.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement?.focus();
                    e.preventDefault();
                }
            }
        };

        element.addEventListener('keydown', handleTab);
        return () => element.removeEventListener('keydown', handleTab);
    }, [active]);

    return ref;
}

/**
 * useReducedMotion Hook
 * Detect user's motion preference
 *
 * @example
 * const prefersReducedMotion = useReducedMotion();
 */
export function useReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const listener = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', listener);
            return () => mediaQuery.removeEventListener('change', listener);
        } else {
            mediaQuery.addListener(listener);
            return () => mediaQuery.removeListener(listener);
        }
    }, []);

    return prefersReducedMotion;
}

/**
 * useAnnounce Hook
 * Screen reader announcements via ARIA live region
 *
 * @example
 * const announce = useAnnounce();
 * announce('File uploaded successfully', 'polite');
 */
export function useAnnounce() {
    const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
        const announcer = document.getElementById('announcements');
        if (announcer) {
            announcer.setAttribute('aria-live', priority);
            announcer.textContent = message;

            // Clear after announcement
            setTimeout(() => {
                announcer.textContent = '';
            }, 1000);
        }
    }, []);

    return announce;
}
