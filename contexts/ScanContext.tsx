'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ScanContextType {
    capturedImage: string | null;
    setCapturedImage: (img: string | null) => void;
    triggerNativeCamera: () => void;
}

const ScanContext = createContext<ScanContextType>({
    capturedImage: null,
    setCapturedImage: () => { },
    triggerNativeCamera: () => { },
});

export const useScanConfig = () => useContext(ScanContext);

export const ScanProvider = ({ children }: { children: React.ReactNode }) => {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                setCapturedImage(ev.target?.result as string);
                // Small delay to ensure state updates before routing
                setTimeout(() => {
                    router.push('/scan?source=camera');
                }, 50);
            };
            reader.readAsDataURL(file);
        }
        // Reset so picking the same file again works
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const triggerNativeCamera = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);

    return (
        <ScanContext.Provider value={{ capturedImage, setCapturedImage, triggerNativeCamera }}>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
            />
            {children}
        </ScanContext.Provider>
    );
};
