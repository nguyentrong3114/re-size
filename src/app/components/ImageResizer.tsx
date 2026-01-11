'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';

interface ImageFile {
    id: string;
    file: File;
    preview: string;
    resizedPreview?: string;
    originalSize: { width: number; height: number };
    newSize: { width: number; height: number };
    status: 'pending' | 'processing' | 'completed' | 'error';
}

interface ResizeOptions {
    width: number;
    height: number;
    maintainAspectRatio: boolean;
    quality: number;
    format: 'jpeg' | 'png' | 'webp';
}

export default function ImageResizer() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [resizeOptions, setResizeOptions] = useState<ResizeOptions>({
        width: 800,
        height: 600,
        maintainAspectRatio: true,
        quality: 0.9,
        format: 'jpeg',
    });
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Update all images when resize options change
    useEffect(() => {
        if (images.length > 0) {
            setImages(prev =>
                prev.map(img => {
                    const aspectRatio = img.originalSize.width / img.originalSize.height;
                    return {
                        ...img,
                        newSize: resizeOptions.maintainAspectRatio
                            ? {
                                width: resizeOptions.width,
                                height: Math.round(resizeOptions.width / aspectRatio),
                            }
                            : { width: resizeOptions.width, height: resizeOptions.height },
                        // Reset status to pending when dimensions change
                        status: img.status === 'completed' ? 'pending' as const : img.status,
                        resizedPreview: img.status === 'completed' ? undefined : img.resizedPreview,
                    };
                })
            );
        }
    }, [resizeOptions.width, resizeOptions.height, resizeOptions.maintainAspectRatio]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files) return;

        const imageFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/')
        );

        const newImages: ImageFile[] = await Promise.all(
            imageFiles.map(async (file) => {
                const dimensions = await getImageDimensions(file);
                const aspectRatio = dimensions.width / dimensions.height;

                return {
                    id: Math.random().toString(36).substr(2, 9),
                    file,
                    preview: URL.createObjectURL(file),
                    originalSize: dimensions,
                    newSize: resizeOptions.maintainAspectRatio
                        ? {
                            width: resizeOptions.width,
                            height: Math.round(resizeOptions.width / aspectRatio),
                        }
                        : { width: resizeOptions.width, height: resizeOptions.height },
                    status: 'pending' as const,
                };
            })
        );

        setImages(prev => [...prev, ...newImages]);
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        await handleFiles(e.dataTransfer.files);
    }, [resizeOptions]);

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        await handleFiles(e.target.files);
    };

    const resizeImage = async (
        imageFile: ImageFile,
        options: ResizeOptions
    ): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                canvas.width = imageFile.newSize.width;
                canvas.height = imageFile.newSize.height;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Failed to create blob'));
                        }
                    },
                    `image/${options.format}`,
                    options.quality
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageFile.preview;
        });
    };

    const processImages = async () => {
        setIsProcessing(true);
        setProgress(0);

        const totalImages = images.length;
        const processedImages: ImageFile[] = [];

        for (let i = 0; i < images.length; i++) {
            const image = images[i];

            setImages(prev =>
                prev.map(img =>
                    img.id === image.id ? { ...img, status: 'processing' } : img
                )
            );

            try {
                const resizedBlob = await resizeImage(image, resizeOptions);
                const resizedPreview = URL.createObjectURL(resizedBlob);

                const processedImage = {
                    ...image,
                    resizedPreview,
                    status: 'completed' as const,
                };

                processedImages.push(processedImage);

                setImages(prev =>
                    prev.map(img =>
                        img.id === image.id ? processedImage : img
                    )
                );
            } catch (error) {
                setImages(prev =>
                    prev.map(img =>
                        img.id === image.id ? { ...img, status: 'error' } : img
                    )
                );
            }

            setProgress(((i + 1) / totalImages) * 100);
        }

        setIsProcessing(false);
    };

    const downloadAsZip = async () => {
        const zip = new JSZip();
        const folder = zip.folder('resized-images');

        if (!folder) return;

        for (const image of images) {
            if (image.status === 'completed' && image.resizedPreview) {
                const response = await fetch(image.resizedPreview);
                const blob = await response.blob();
                const fileName = `${image.file.name.split('.')[0]}_resized.${resizeOptions.format}`;
                folder.file(fileName, blob);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resized-images-${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const updateImageSize = (id: string, width: number, height: number) => {
        setImages(prev =>
            prev.map(img => {
                if (img.id === id) {
                    if (resizeOptions.maintainAspectRatio) {
                        const aspectRatio = img.originalSize.width / img.originalSize.height;
                        return {
                            ...img,
                            newSize: {
                                width,
                                height: Math.round(width / aspectRatio),
                            },
                        };
                    }
                    return { ...img, newSize: { width, height } };
                }
                return img;
            })
        );
    };

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const clearAll = () => {
        images.forEach(img => {
            URL.revokeObjectURL(img.preview);
            if (img.resizedPreview) {
                URL.revokeObjectURL(img.resizedPreview);
            }
        });
        setImages([]);
        setProgress(0);
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="text-center mb-12 animate-fadeIn">
                    <h1 className="text-6xl font-bold mb-4 gradient-text">
                        Image Resizer Pro
                    </h1>
                    <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
                        Resize single or multiple images with ease. Download as ZIP file.
                    </p>
                </header>

                {/* Upload Area */}
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
            relative mb-8 p-12 rounded-[var(--radius-xl)] border-2 border-dashed
            transition-all duration-300 cursor-pointer hover-lift
            ${isDragging
                            ? 'border-[var(--primary)] bg-[var(--surface-light)] scale-105'
                            : 'border-[var(--muted)] bg-[var(--surface)]'
                        }
          `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileInput}
                        className="hidden"
                    />

                    <div className="text-center">
                        <div className="mb-4 inline-block p-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-semibold mb-2">Drop images here</h3>
                        <p className="text-[var(--muted)]">or click to browse</p>
                    </div>
                </div>

                {/* Resize Options */}
                {images.length > 0 && (
                    <div className="mb-8 p-6 rounded-[var(--radius-lg)] bg-[var(--surface)] glass animate-slideIn">
                        <h3 className="text-xl font-semibold mb-4">Resize Options</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Width (px)</label>
                                <input
                                    type="number"
                                    value={resizeOptions.width}
                                    onChange={(e) => setResizeOptions(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-4 py-2 rounded-lg bg-[var(--surface-light)] border border-[var(--muted)] focus:border-[var(--primary)] outline-none transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Height (px)</label>
                                <input
                                    type="number"
                                    value={resizeOptions.height}
                                    disabled={resizeOptions.maintainAspectRatio}
                                    onChange={(e) => setResizeOptions(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-4 py-2 rounded-lg bg-[var(--surface-light)] border border-[var(--muted)] focus:border-[var(--primary)] outline-none transition-colors disabled:opacity-50"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Quality</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.1"
                                    value={resizeOptions.quality}
                                    onChange={(e) => setResizeOptions(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                                    className="w-full"
                                />
                                <span className="text-sm text-[var(--muted)]">{Math.round(resizeOptions.quality * 100)}%</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Format</label>
                                <select
                                    value={resizeOptions.format}
                                    onChange={(e) => setResizeOptions(prev => ({ ...prev, format: e.target.value as any }))}
                                    className="w-full px-4 py-2 rounded-lg bg-[var(--surface-light)] border border-[var(--muted)] focus:border-[var(--primary)] outline-none transition-colors"
                                >
                                    <option value="jpeg">JPEG</option>
                                    <option value="png">PNG</option>
                                    <option value="webp">WebP</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={resizeOptions.maintainAspectRatio}
                                    onChange={(e) => setResizeOptions(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                                    className="w-5 h-5 rounded accent-[var(--primary)]"
                                />
                                <span className="text-sm font-medium">Maintain aspect ratio</span>
                            </label>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                onClick={processImages}
                                disabled={isProcessing}
                                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white font-semibold hover:shadow-lg hover-lift disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isProcessing ? 'Processing...' : `Resize ${images.length} Image${images.length > 1 ? 's' : ''}`}
                            </button>

                            {images.some(img => img.status === 'completed') && (
                                <button
                                    onClick={downloadAsZip}
                                    className="px-6 py-3 rounded-lg bg-[var(--success)] text-white font-semibold hover:shadow-lg hover-lift transition-all"
                                >
                                    Download ZIP
                                </button>
                            )}

                            <button
                                onClick={clearAll}
                                className="px-6 py-3 rounded-lg bg-[var(--error)] text-white font-semibold hover:shadow-lg hover-lift transition-all"
                            >
                                Clear All
                            </button>
                        </div>

                        {isProcessing && (
                            <div className="mt-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Processing...</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 bg-[var(--surface-light)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Image Grid */}
                {images.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {images.map((image) => (
                            <div
                                key={image.id}
                                className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface)] glass hover-lift animate-fadeIn"
                            >
                                <div className="relative mb-3">
                                    <img
                                        src={image.resizedPreview || image.preview}
                                        alt={image.file.name}
                                        className="w-full h-48 object-cover rounded-lg"
                                    />

                                    <button
                                        onClick={() => removeImage(image.id)}
                                        className="absolute top-2 right-2 p-2 rounded-full bg-[var(--error)] text-white hover:scale-110 transition-transform"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>

                                    {image.status === 'processing' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent" />
                                        </div>
                                    )}

                                    {image.status === 'completed' && (
                                        <div className="absolute top-2 left-2 px-3 py-1 rounded-full bg-[var(--success)] text-white text-xs font-semibold">
                                            ✓ Done
                                        </div>
                                    )}
                                </div>

                                <h4 className="font-medium text-sm mb-2 truncate">{image.file.name}</h4>

                                <div className="text-xs text-[var(--muted)] space-y-1">
                                    <div className="flex justify-between">
                                        <span>Original:</span>
                                        <span>{image.originalSize.width} × {image.originalSize.height}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>New:</span>
                                        <span>{image.newSize.width} × {image.newSize.height}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Size:</span>
                                        <span>{(image.file.size / 1024).toFixed(2)} KB</span>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs mb-1">Width</label>
                                        <input
                                            type="number"
                                            value={image.newSize.width}
                                            onChange={(e) => updateImageSize(image.id, parseInt(e.target.value) || 0, image.newSize.height)}
                                            className="w-full px-2 py-1 text-sm rounded bg-[var(--surface-light)] border border-[var(--muted)] focus:border-[var(--primary)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs mb-1">Height</label>
                                        <input
                                            type="number"
                                            value={image.newSize.height}
                                            disabled={resizeOptions.maintainAspectRatio}
                                            onChange={(e) => updateImageSize(image.id, image.newSize.width, parseInt(e.target.value) || 0)}
                                            className="w-full px-2 py-1 text-sm rounded bg-[var(--surface-light)] border border-[var(--muted)] focus:border-[var(--primary)] outline-none disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {images.length === 0 && (
                    <div className="text-center py-20 animate-fadeIn">
                        <div className="inline-block p-8 rounded-full bg-[var(--surface)] mb-4">
                            <svg className="w-16 h-16 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-semibold mb-2">No images yet</h3>
                        <p className="text-[var(--muted)]">Upload some images to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
}
