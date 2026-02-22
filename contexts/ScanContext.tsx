'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
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
    const router = useRouter();

    const triggerNativeCamera = useCallback(() => {
        setCapturedImage(null);
        router.push('/scan');
    }, [router]);

    return (
        <ScanContext.Provider value={{ capturedImage, setCapturedImage, triggerNativeCamera }}>
            {children}
        </ScanContext.Provider>
    );
};
