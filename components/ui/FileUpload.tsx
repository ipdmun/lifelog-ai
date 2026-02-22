'use client';

import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  disabled?: boolean;
  className?: string;
}

export type UploadStatus = 'idle' | 'dragging' | 'selected' | 'uploading' | 'success' | 'error';

/**
 * FileUpload Component
 *
 * Accessible file upload with drag-drop, keyboard support, and validation.
 * Includes ARIA live announcements for status updates.
 *
 * @example
 * <FileUpload
 *   accept=".ics"
 *   maxSize={10 * 1024 * 1024} // 10MB
 *   onFileSelect={(file) => handleUpload(file)}
 * />
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  accept,
  maxSize = 10 * 1024 * 1024, // Default 10MB
  onFileSelect,
  onFileRemove,
  disabled = false,
  className,
}) => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Announce to screen readers
  const announce = useCallback((message: string) => {
    const announcer = document.getElementById('announcements');
    if (announcer) {
      announcer.textContent = message;
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }, []);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;

      const isValidType = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        return mimeType.match(new RegExp(type.replace('*', '.*')));
      });

      if (!isValidType) {
        return `Invalid file type. Please select a file matching: ${accept}`;
      }
    }

    // Check file size
    if (maxSize && file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      return `File is too large. Maximum size is ${maxSizeMB}MB.`;
    }

    return null;
  }, [accept, maxSize]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);

    if (validationError) {
      setError(validationError);
      setStatus('error');
      announce(`Error: ${validationError}`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    setStatus('selected');
    announce(`File selected: ${file.name}`);
    onFileSelect(file);
  }, [validateFile, onFileSelect, announce]);

  // Handle file input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && status !== 'uploading') {
      setStatus('dragging');
      announce('Drop zone active');
    }
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (status === 'dragging') {
      setStatus(selectedFile ? 'selected' : 'idle');
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || status === 'uploading') return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    } else {
      setStatus(selectedFile ? 'selected' : 'idle');
    }
  };

  // Handle file remove
  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
    setStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    announce('File removed');
    onFileRemove?.();
  };

  // Open file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Handle keyboard interaction
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);

  return (
    <div className={cn('w-full', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
        aria-label="File upload input"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        onClick={!disabled && !selectedFile ? openFilePicker : undefined}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="File upload area. Press Enter or Space to select a file."
        aria-disabled={disabled}
        className={cn(
          'relative rounded-xl border-2 border-dashed',
          'min-h-[200px] sm:min-h-[240px]',
          'flex flex-col items-center justify-center',
          'p-6 sm:p-8',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary-500)]',

          // Status-based styles
          status === 'idle' && [
            'border-[var(--color-neutral-300)] bg-white',
            'hover:border-[var(--color-primary-400)] hover:bg-[var(--color-primary-50)]',
            'cursor-pointer',
          ],
          status === 'dragging' && [
            'border-[var(--color-primary-500)] bg-[var(--color-primary-50)]',
            'scale-[1.02]',
          ],
          status === 'selected' && [
            'border-[var(--color-neutral-300)] bg-white',
          ],
          status === 'error' && [
            'border-[var(--color-error-500)] bg-[var(--color-error-50)]',
          ],
          disabled && 'opacity-50 cursor-not-allowed hover:border-[var(--color-neutral-300)] hover:bg-white'
        )}
      >
        {/* No file selected */}
        {!selectedFile && !error && (
          <div className="text-center space-y-4">
            <div
              className={cn(
                'w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors',
                status === 'dragging'
                  ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-600)]'
                  : 'bg-[var(--color-neutral-100)] text-[var(--color-neutral-500)]'
              )}
            >
              <Upload size={32} />
            </div>

            <div>
              <p className="text-base sm:text-lg font-semibold text-[var(--color-neutral-900)] mb-2">
                {status === 'dragging' ? 'Drop your file here' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-[var(--color-neutral-600)]">
                {accept ? `Accepted formats: ${accept}` : 'All file types accepted'}
              </p>
              <p className="text-sm text-[var(--color-neutral-600)] mt-1">
                Maximum file size: {maxSizeMB}MB
              </p>
            </div>

            {!disabled && (
              <Button variant="outline" size="md" type="button">
                Choose File
              </Button>
            )}
          </div>
        )}

        {/* File selected */}
        {selectedFile && !error && (
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center gap-4 p-4 bg-[var(--color-success-50)] border border-[var(--color-success-200)] rounded-lg">
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[var(--color-success-100)] text-[var(--color-success-600)] flex items-center justify-center">
                <File size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-neutral-900)] truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-[var(--color-neutral-600)] mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className={cn(
                  'flex-shrink-0 p-2 rounded-lg',
                  'text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]',
                  'hover:bg-[var(--color-neutral-100)]',
                  'transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]'
                )}
                aria-label="Remove file"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[var(--color-success-700)]">
              <CheckCircle size={20} />
              <p className="text-sm font-medium">File ready to upload</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-[var(--color-error-700)]">
              <AlertCircle size={24} />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={openFilePicker}
              type="button"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
