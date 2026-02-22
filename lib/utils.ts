import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Announce message to screen readers via ARIA live region
 *
 * @param message - Message to announce
 * @param priority - Announcement priority ('polite' | 'assertive')
 *
 * @example
 * announce('File uploaded successfully', 'polite');
 */
export function announce(
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
): void {
    const announcer = document.getElementById('announcements');
    if (announcer) {
        announcer.setAttribute('aria-live', priority);
        announcer.textContent = message;

        // Clear after announcement
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }
}

/**
 * Trap focus within an element
 *
 * @param element - Element to trap focus within
 * @returns Cleanup function
 *
 * @example
 * const cleanup = trapFocus(modalElement);
 * // Later: cleanup();
 */
export function trapFocus(element: HTMLElement): () => void {
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

    // Return cleanup function
    return () => {
        element.removeEventListener('keydown', handleTab);
    };
}

/**
 * Store currently focused element and return function to restore it
 *
 * @example
 * const restoreFocus = storeFocus();
 * // Later: restoreFocus();
 */
export function storeFocus(): () => void {
    const activeElement = document.activeElement as HTMLElement;

    return () => {
        if (activeElement && typeof activeElement.focus === 'function') {
            activeElement.focus();
        }
    };
}

/**
 * Get contrast ratio between two colors
 * Based on WCAG 2.1 formula
 *
 * @param color1 - First color (hex format)
 * @param color2 - Second color (hex format)
 * @returns Contrast ratio (1-21)
 *
 * @example
 * const ratio = getContrastRatio('#000000', '#FFFFFF'); // ~21
 */
export function getContrastRatio(color1: string, color2: string): number {
    // Convert hex to RGB
    const hexToRgb = (hex: string): [number, number, number] => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? [
                parseInt(result[1], 16),
                parseInt(result[2], 16),
                parseInt(result[3], 16),
            ]
            : [0, 0, 0];
    };

    // Get relative luminance
    const getLuminance = (rgb: [number, number, number]): number => {
        const [r, g, b] = rgb.map((val) => {
            const normalized = val / 255;
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(hexToRgb(color1));
    const lum2 = getLuminance(hexToRgb(color2));

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG standards
 *
 * @param ratio - Contrast ratio to check
 * @param level - WCAG level ('AA' | 'AAA')
 * @param isLargeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns Whether contrast meets standard
 *
 * @example
 * const ratio = getContrastRatio('#000000', '#FFFFFF');
 * const meetsAA = meetsContrastRequirement(ratio, 'AA', false);
 */
export function meetsContrastRequirement(
    ratio: number,
    level: 'AA' | 'AAA' = 'AA',
    isLargeText: boolean = false
): boolean {
    if (level === 'AAA') {
        return isLargeText ? ratio >= 4.5 : ratio >= 7;
    }
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Format file size in human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 *
 * @example
 * formatFileSize(1024); // "1 KB"
 * formatFileSize(1536000); // "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Debounce function
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 *
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
