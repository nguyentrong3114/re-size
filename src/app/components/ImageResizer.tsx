'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import {
    MdPhotoSizeSelectActual,
    MdCameraRoll,
    MdImage,
    MdVideoLibrary,
    MdMonitor,
    MdTv,
    MdSettings,
    MdCloudUpload,
    MdCheckCircle,
    MdError,
    MdDelete,
    MdDownload,
    MdDeleteSweep,
    MdRocketLaunch,
    MdArchive,
    MdStraighten,
    MdAspectRatio,
    MdLock,
    MdAutoAwesome,
    MdPhotoLibrary,
    MdInfo,
    MdRotateRight,
    MdRotateLeft,
    MdZoomIn,
    MdClose,
    MdCompareArrows,
    MdSpeed,
    MdStorage,
    MdFlashOn,
    MdTune,
    MdGridView,
    MdViewList,
    MdEdit,
    MdFolder
} from 'react-icons/md';
import { FaTwitter, FaInstagram, FaFacebook, FaYoutube } from 'react-icons/fa';
import { HiSparkles } from 'react-icons/hi2';

// Preset sizes for quick selection
const PRESET_SIZES = [
    { name: 'Instagram Post', width: 1080, height: 1080, Icon: FaInstagram, color: '#E4405F' },
    { name: 'Instagram Story', width: 1080, height: 1920, Icon: MdCameraRoll, color: '#C13584' },
    { name: 'Facebook Cover', width: 820, height: 312, Icon: FaFacebook, color: '#1877F2' },
    { name: 'YouTube Thumbnail', width: 1280, height: 720, Icon: FaYoutube, color: '#FF0000' },
    { name: 'Twitter Header', width: 1500, height: 500, Icon: FaTwitter, color: '#1DA1F2' },
    { name: 'HD (720p)', width: 1280, height: 720, Icon: MdMonitor, color: '#00f5d4' },
    { name: 'Full HD (1080p)', width: 1920, height: 1080, Icon: MdTv, color: '#9b5de5' },
    { name: 'Custom', width: 800, height: 600, Icon: MdSettings, color: '#f15bb5' },
];

interface ImageFile {
    id: string;
    file: File;
    preview: string;
    resizedPreview?: string;
    resizedBlob?: Blob;
    originalSize: { width: number; height: number };
    newSize: { width: number; height: number };
    status: 'pending' | 'processing' | 'completed' | 'error';
    rotation: number;
}

interface ResizeOptions {
    width: number;
    height: number;
    maintainAspectRatio: boolean;
    quality: number;
    format: 'jpeg' | 'png' | 'webp';
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" }
    }
};

const cardVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.4, ease: "easeOut" }
    },
    exit: {
        opacity: 0,
        scale: 0.9,
        transition: { duration: 0.2 }
    }
};

export default function ImageResizer() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [resizeOptions, setResizeOptions] = useState<ResizeOptions>({
        width: 1080,
        height: 1080,
        maintainAspectRatio: true,
        quality: 0.9,
        format: 'jpeg',
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [selectedPreset, setSelectedPreset] = useState<string>('Instagram Post');
    const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
    const [showCompare, setShowCompare] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showZipModal, setShowZipModal] = useState(false);
    const [zipFileName, setZipFileName] = useState('resized-images');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dropzone configuration
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
        
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
                    rotation: 0,
                };
            })
        );

        setImages(prev => [...prev, ...newImages]);
    }, [resizeOptions]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp']
        },
        multiple: true
    });

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
                        status: img.status === 'completed' ? 'pending' as const : img.status,
                        resizedPreview: img.status === 'completed' ? undefined : img.resizedPreview,
                        resizedBlob: img.status === 'completed' ? undefined : img.resizedBlob,
                    };
                })
            );
        }
    }, [resizeOptions.width, resizeOptions.height, resizeOptions.maintainAspectRatio]);

    const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({ width: img.width, height: img.height });
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const rotateImage = (id: string, direction: 'left' | 'right') => {
        setImages(prev =>
            prev.map(img => {
                if (img.id === id) {
                    const newRotation = direction === 'right' 
                        ? (img.rotation + 90) % 360 
                        : (img.rotation - 90 + 360) % 360;
                    return { 
                        ...img, 
                        rotation: newRotation,
                        status: 'pending' as const,
                        resizedPreview: undefined,
                        resizedBlob: undefined
                    };
                }
                return img;
            })
        );
    };

    const resizeImage = async (
        imageFile: ImageFile,
        options: ResizeOptions
    ): Promise<{ blob: Blob; preview: string }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Handle rotation
                const isRotated = imageFile.rotation === 90 || imageFile.rotation === 270;
                if (isRotated) {
                    canvas.width = imageFile.newSize.height;
                    canvas.height = imageFile.newSize.width;
                } else {
                    canvas.width = imageFile.newSize.width;
                    canvas.height = imageFile.newSize.height;
                }

                // Apply rotation
                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((imageFile.rotation * Math.PI) / 180);
                
                if (isRotated) {
                    ctx.drawImage(img, -imageFile.newSize.width / 2, -imageFile.newSize.height / 2, imageFile.newSize.width, imageFile.newSize.height);
                } else {
                    ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
                }
                ctx.restore();

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve({ blob, preview: URL.createObjectURL(blob) });
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

        for (let i = 0; i < images.length; i++) {
            const image = images[i];

            setImages(prev =>
                prev.map(img =>
                    img.id === image.id ? { ...img, status: 'processing' as const } : img
                )
            );

            try {
                const { blob, preview } = await resizeImage(image, resizeOptions);

                setImages(prev =>
                    prev.map(img =>
                        img.id === image.id ? { 
                            ...img, 
                            resizedPreview: preview, 
                            resizedBlob: blob,
                            status: 'completed' as const 
                        } : img
                    )
                );
            } catch (error) {
                setImages(prev =>
                    prev.map(img =>
                        img.id === image.id ? { ...img, status: 'error' as const } : img
                    )
                );
            }

            setProgress(((i + 1) / totalImages) * 100);
        }

        setIsProcessing(false);
    };

    const downloadSingleImage = async (image: ImageFile) => {
        if (!image.resizedBlob) return;
        
        const url = URL.createObjectURL(image.resizedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${image.file.name.split('.')[0]}_resized.${resizeOptions.format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadAsZip = async () => {
        const zip = new JSZip();
        const folderName = zipFileName || 'resized-images';
        const folder = zip.folder(folderName);

        if (!folder) return;

        for (const image of images) {
            if (image.status === 'completed' && image.resizedBlob) {
                const fileName = `${image.file.name.split('.')[0]}_resized.${resizeOptions.format}`;
                folder.file(fileName, image.resizedBlob);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setShowZipModal(false);
    };

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
        if (selectedImage?.id === id) {
            setSelectedImage(null);
        }
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
        setSelectedImage(null);
    };

    const applyPreset = (preset: typeof PRESET_SIZES[0]) => {
        setSelectedPreset(preset.name);
        setResizeOptions(prev => ({
            ...prev,
            width: preset.width,
            height: preset.height,
            maintainAspectRatio: preset.name !== 'Custom',
        }));
    };

    // Calculate stats
    const completedImages = images.filter(img => img.status === 'completed');
    const totalOriginalSize = images.reduce((acc, img) => acc + img.file.size, 0);
    const totalResizedSize = completedImages.reduce((acc, img) => acc + (img.resizedBlob?.size || 0), 0);
    const savedBytes = totalOriginalSize - totalResizedSize;
    const savedPercentage = totalOriginalSize > 0 ? Math.round((savedBytes / totalOriginalSize) * 100) : 0;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="min-h-screen">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--primary)] opacity-10 rounded-full blur-[120px] animate-float" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--secondary)] opacity-10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '-1.5s' }} />
                <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[var(--accent)] opacity-8 rounded-full blur-[100px] animate-float" style={{ animationDelay: '-3s' }} />
            </div>

            <div className="relative z-10 p-4 md:p-6 lg:p-8">
                <motion.div 
                    className="max-w-[1800px] mx-auto"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Header */}
                    <motion.header 
                        className="text-center mb-8 md:mb-12"
                        variants={itemVariants}
                    >
                        <div className="inline-flex items-center gap-3 mb-4">
                            <motion.div 
                                className="p-4 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]"
                                whileHover={{ rotate: 10, scale: 1.1 }}
                                transition={{ type: "spring", stiffness: 300 }}
                            >
                                <HiSparkles className="text-3xl md:text-4xl text-[var(--background)]" />
                            </motion.div>
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4">
                            <span className="gradient-text">Image Resizer</span>
                            <span className="text-[var(--primary)]"> Pro</span>
                        </h1>
                        <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto">
                            Resize ảnh chuyên nghiệp với chất lượng cao • Hỗ trợ batch processing • Tải về ZIP
                        </p>
                        
                        {/* Feature Pills */}
                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            {[
                                { icon: MdFlashOn, text: 'Siêu nhanh' },
                                { icon: MdLock, text: 'Giữ tỉ lệ' },
                                { icon: MdArchive, text: 'Tải ZIP' },
                                { icon: MdCompareArrows, text: 'So sánh' }
                            ].map((feature, i) => (
                                <motion.div
                                    key={feature.text}
                                    className="badge badge-primary flex items-center gap-2"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                >
                                    <feature.icon className="text-sm" />
                                    {feature.text}
                                </motion.div>
                            ))}
                        </div>
                    </motion.header>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {/* Left Sidebar - Options */}
                        <motion.aside 
                            className="xl:col-span-3 space-y-6"
                            variants={itemVariants}
                        >
                            {/* Preset Sizes */}
                            <div className="card glass">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 gradient-text-primary">
                                    <MdAspectRatio className="text-xl" />
                                    Kích thước nhanh
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {PRESET_SIZES.map((preset) => {
                                        const IconComponent = preset.Icon;
                                        const isSelected = selectedPreset === preset.name;
                                        return (
                                            <motion.button
                                                key={preset.name}
                                                onClick={() => applyPreset(preset)}
                                                className={`
                                                    p-3 rounded-xl text-left transition-all
                                                    ${isSelected
                                                        ? 'bg-gradient-to-br from-[var(--primary)]/20 to-[var(--secondary)]/20 border-2 border-[var(--primary)]'
                                                        : 'bg-[var(--surface-light)] border-2 border-transparent hover:border-[var(--surface-lighter)]'
                                                    }
                                                `}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <IconComponent 
                                                    className="text-2xl mb-2" 
                                                    style={{ color: isSelected ? preset.color : 'var(--muted)' }}
                                                />
                                                <div className="text-xs font-medium truncate">{preset.name}</div>
                                                <div className="text-[10px] text-[var(--muted)]">
                                                    {preset.width}×{preset.height}
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Settings */}
                            <div className="card glass">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 gradient-text-primary">
                                    <MdTune className="text-xl" />
                                    Tùy chỉnh
                                </h3>
                                
                                <div className="space-y-4">
                                    {/* Dimensions */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-[var(--muted)] mb-1 block">Rộng (px)</label>
                                            <input
                                                type="number"
                                                value={resizeOptions.width}
                                                onChange={(e) => {
                                                    setResizeOptions(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }));
                                                    setSelectedPreset('Custom');
                                                }}
                                                className="input text-center"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--muted)] mb-1 block">Cao (px)</label>
                                            <input
                                                type="number"
                                                value={resizeOptions.height}
                                                disabled={resizeOptions.maintainAspectRatio}
                                                onChange={(e) => {
                                                    setResizeOptions(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }));
                                                    setSelectedPreset('Custom');
                                                }}
                                                className="input text-center"
                                            />
                                        </div>
                                    </div>

                                    {/* Aspect Ratio Toggle */}
                                    <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-light)] cursor-pointer hover:bg-[var(--surface-lighter)] transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={resizeOptions.maintainAspectRatio}
                                            onChange={(e) => setResizeOptions(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                                        />
                                        <div>
                                            <div className="text-sm font-medium flex items-center gap-2">
                                                <MdLock className="text-[var(--primary)]" /> Giữ tỉ lệ
                                            </div>
                                            <div className="text-xs text-[var(--muted)]">Không bị méo ảnh</div>
                                        </div>
                                    </label>

                                    {/* Quality Slider */}
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-medium flex items-center gap-2">
                                                <MdAutoAwesome className="text-[var(--primary)]" /> Chất lượng
                                            </label>
                                            <span className="text-sm font-bold text-[var(--primary)]">
                                                {Math.round(resizeOptions.quality * 100)}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={resizeOptions.quality}
                                            onChange={(e) => setResizeOptions(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                                            style={{
                                                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${resizeOptions.quality * 100}%, var(--surface-light) ${resizeOptions.quality * 100}%, var(--surface-light) 100%)`
                                            }}
                                        />
                                    </div>

                                    {/* Format Select */}
                                    <div>
                                        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                                            <MdImage className="text-[var(--primary)]" /> Định dạng
                                        </label>
                                        <select
                                            value={resizeOptions.format}
                                            onChange={(e) => setResizeOptions(prev => ({ ...prev, format: e.target.value as any }))}
                                            className="w-full"
                                        >
                                            <option value="jpeg">JPEG - Nhỏ gọn</option>
                                            <option value="png">PNG - Chất lượng cao</option>
                                            <option value="webp">WebP - Hiện đại</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            {images.length > 0 && (
                                <motion.div 
                                    className="card glass"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 gradient-text-primary">
                                        <MdInfo className="text-xl" />
                                        Thống kê
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-light)]">
                                            <span className="text-sm text-[var(--muted)]">Tổng ảnh</span>
                                            <span className="font-bold text-lg">{images.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-light)]">
                                            <span className="text-sm text-[var(--muted)]">Đã xử lý</span>
                                            <span className="font-bold text-lg text-[var(--success)]">{completedImages.length}</span>
                                        </div>
                                        {completedImages.length > 0 && (
                                            <>
                                                <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-light)]">
                                                    <span className="text-sm text-[var(--muted)]">Dung lượng gốc</span>
                                                    <span className="font-bold">{formatBytes(totalOriginalSize)}</span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 rounded-xl bg-gradient-to-r from-[var(--success)]/10 to-transparent border border-[var(--success)]/30">
                                                    <span className="text-sm text-[var(--success)]">Đã tiết kiệm</span>
                                                    <span className="font-bold text-[var(--success)]">
                                                        {savedPercentage > 0 ? `${savedPercentage}%` : '-'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </motion.aside>

                        {/* Main Area */}
                        <motion.main 
                            className="xl:col-span-9 space-y-6"
                            variants={itemVariants}
                        >
                            {/* Upload Area */}
                            <div
                                {...getRootProps()}
                                className={`
                                    relative p-8 md:p-12 rounded-3xl border-2 border-dashed cursor-pointer
                                    transition-all duration-300 group
                                    ${isDragActive
                                        ? 'border-[var(--primary)] bg-[var(--primary)]/5 scale-[1.02]'
                                        : 'border-[var(--surface-lighter)] bg-[var(--surface)]/50 hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]'
                                    }
                                `}
                            >
                                <input {...getInputProps()} />
                                
                                <div className="text-center">
                                    <motion.div 
                                        className={`
                                            inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6
                                            bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]
                                            ${isDragActive ? 'animate-pulse-glow' : ''}
                                        `}
                                        animate={isDragActive ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                                        transition={{ duration: 0.5, repeat: isDragActive ? Infinity : 0 }}
                                    >
                                        <MdCloudUpload className="text-4xl text-[var(--background)]" />
                                    </motion.div>
                                    
                                    <h3 className="text-2xl md:text-3xl font-bold mb-2">
                                        {isDragActive ? (
                                            <span className="gradient-text">Thả ảnh vào đây!</span>
                                        ) : (
                                            'Kéo thả ảnh vào đây'
                                        )}
                                    </h3>
                                    <p className="text-[var(--muted)] mb-4">hoặc click để chọn file</p>
                                    
                                    <div className="flex flex-wrap justify-center gap-2 text-xs text-[var(--muted)]">
                                        {['JPG', 'PNG', 'WebP', 'GIF', 'BMP'].map(format => (
                                            <span key={format} className="px-3 py-1 rounded-full bg-[var(--surface-light)]">
                                                {format}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Decorative corners */}
                                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[var(--primary)] rounded-tl-lg opacity-50" />
                                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[var(--primary)] rounded-tr-lg opacity-50" />
                                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[var(--primary)] rounded-bl-lg opacity-50" />
                                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[var(--primary)] rounded-br-lg opacity-50" />
                            </div>

                            {/* Action Bar */}
                            {images.length > 0 && (
                                <motion.div 
                                    className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl glass"
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                            <MdPhotoLibrary className="text-[var(--primary)]" />
                                            {images.length} ảnh
                                        </h3>
                                        
                                        {/* View Toggle */}
                                        <div className="flex rounded-xl overflow-hidden border border-[var(--surface-lighter)]">
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={`p-2 ${viewMode === 'grid' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-[var(--surface-light)]'}`}
                                            >
                                                <MdGridView />
                                            </button>
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`p-2 ${viewMode === 'list' ? 'bg-[var(--primary)] text-[var(--background)]' : 'bg-[var(--surface-light)]'}`}
                                            >
                                                <MdViewList />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <motion.button
                                            onClick={processImages}
                                            disabled={isProcessing}
                                            className="btn-primary flex items-center gap-2 disabled:opacity-50"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {isProcessing ? (
                                                <>
                                                    <div className="w-5 h-5 border-2 border-[var(--background)] border-t-transparent rounded-full animate-spin" />
                                                    Đang xử lý...
                                                </>
                                            ) : (
                                                <>
                                                    <MdRocketLaunch />
                                                    Resize tất cả
                                                </>
                                            )}
                                        </motion.button>

                                        {completedImages.length > 0 && (
                                            <motion.button
                                                onClick={() => setShowZipModal(true)}
                                                className="btn-secondary flex items-center gap-2"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <MdArchive />
                                                Tải ZIP
                                            </motion.button>
                                        )}

                                        <motion.button
                                            onClick={clearAll}
                                            className="btn-danger flex items-center gap-2"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <MdDeleteSweep />
                                            Xóa tất cả
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Progress Bar */}
                            <AnimatePresence>
                                {isProcessing && (
                                    <motion.div 
                                        className="p-4 rounded-2xl glass"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-medium flex items-center gap-2">
                                                <MdSpeed className="text-[var(--primary)]" />
                                                Đang xử lý...
                                            </span>
                                            <span className="text-lg font-bold text-[var(--primary)]">{Math.round(progress)}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <motion.div 
                                                className="progress-bar-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Image Grid */}
                            {images.length > 0 && (
                                <motion.div 
                                    className={`
                                        grid gap-4
                                        ${viewMode === 'grid' 
                                            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' 
                                            : 'grid-cols-1'
                                        }
                                    `}
                                    layout
                                >
                                    <AnimatePresence mode="popLayout">
                                        {images.map((image, index) => (
                                            <motion.div
                                                key={image.id}
                                                layout
                                                variants={cardVariants}
                                                initial="hidden"
                                                animate="visible"
                                                exit="exit"
                                                className={`
                                                    group relative rounded-2xl bg-[var(--surface)] border border-[var(--surface-lighter)] overflow-hidden
                                                    hover:border-[var(--primary)]/50 transition-colors
                                                    ${viewMode === 'list' ? 'flex items-center gap-4 p-4' : ''}
                                                `}
                                            >
                                                {/* Image Preview */}
                                                <div 
                                                    className={`
                                                        relative overflow-hidden cursor-pointer
                                                        ${viewMode === 'grid' ? 'aspect-square' : 'w-24 h-24 rounded-xl flex-shrink-0'}
                                                    `}
                                                    onClick={() => {
                                                        setSelectedImage(image);
                                                        if (image.status === 'completed') setShowCompare(true);
                                                    }}
                                                >
                                                    <img
                                                        src={image.resizedPreview || image.preview}
                                                        alt={image.file.name}
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                        style={{ transform: `rotate(${image.rotation}deg)` }}
                                                    />

                                                    {/* Hover Overlay */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); rotateImage(image.id, 'left'); }}
                                                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                                        >
                                                            <MdRotateLeft className="text-white text-xl" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); rotateImage(image.id, 'right'); }}
                                                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                                        >
                                                            <MdRotateRight className="text-white text-xl" />
                                                        </button>
                                                        {image.status === 'completed' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedImage(image); setShowCompare(true); }}
                                                                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                                            >
                                                                <MdCompareArrows className="text-white text-xl" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Processing Overlay */}
                                                    {image.status === 'processing' && (
                                                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                                            <div className="w-10 h-10 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mb-2" />
                                                            <span className="text-white text-xs">Đang xử lý...</span>
                                                        </div>
                                                    )}

                                                    {/* Status Badge */}
                                                    {image.status === 'completed' && viewMode === 'grid' && (
                                                        <div className="absolute top-2 left-2 badge badge-success">
                                                            <MdCheckCircle />
                                                            <span>Xong</span>
                                                        </div>
                                                    )}
                                                    {image.status === 'error' && viewMode === 'grid' && (
                                                        <div className="absolute top-2 left-2 badge badge-error">
                                                            <MdError />
                                                            <span>Lỗi</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Image Info */}
                                                <div className={`${viewMode === 'grid' ? 'p-3' : 'flex-1'}`}>
                                                    <h4 className="font-medium text-sm truncate mb-2" title={image.file.name}>
                                                        {image.file.name}
                                                    </h4>

                                                    <div className={`text-xs space-y-1 ${viewMode === 'list' ? 'flex gap-4' : ''}`}>
                                                        <div className={`flex items-center justify-between ${viewMode === 'list' ? 'gap-2' : 'p-2 rounded-lg bg-[var(--surface-light)]'}`}>
                                                            <span className="text-[var(--muted)]">Gốc:</span>
                                                            <span className="font-medium">{image.originalSize.width}×{image.originalSize.height}</span>
                                                        </div>
                                                        <div className={`flex items-center justify-between ${viewMode === 'list' ? 'gap-2' : 'p-2 rounded-lg bg-[var(--surface-light)]'}`}>
                                                            <span className="text-[var(--muted)]">Mới:</span>
                                                            <span className="font-medium text-[var(--primary)]">{image.newSize.width}×{image.newSize.height}</span>
                                                        </div>
                                                        <div className={`flex items-center justify-between ${viewMode === 'list' ? 'gap-2' : 'p-2 rounded-lg bg-[var(--surface-light)]'}`}>
                                                            <span className="text-[var(--muted)]">Size:</span>
                                                            <span className="font-medium">{formatBytes(image.file.size)}</span>
                                                        </div>
                                                        
                                                        {viewMode === 'list' && image.status === 'completed' && (
                                                            <div className="badge badge-success">
                                                                <MdCheckCircle />
                                                                Hoàn thành
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className={`
                                                    ${viewMode === 'grid' 
                                                        ? 'absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity' 
                                                        : 'flex items-center gap-2'
                                                    }
                                                `}>
                                                    {image.status === 'completed' && (
                                                        <button
                                                            onClick={() => downloadSingleImage(image)}
                                                            className="p-2 rounded-lg bg-[var(--primary)] text-[var(--background)] hover:bg-[var(--primary-dark)] transition-colors"
                                                            title="Tải về"
                                                        >
                                                            <MdDownload className="text-lg" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => removeImage(image.id)}
                                                        className="p-2 rounded-lg bg-[var(--error)] text-white hover:bg-[var(--error)]/80 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <MdDelete className="text-lg" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            )}

                            {/* Empty State */}
                            {images.length === 0 && (
                                <motion.div 
                                    className="text-center py-16"
                                    variants={itemVariants}
                                >
                                    <motion.div 
                                        className="inline-block p-8 rounded-3xl bg-gradient-to-br from-[var(--surface)] to-[var(--surface-light)] mb-6"
                                        animate={{ y: [0, -10, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <MdPhotoLibrary className="text-6xl text-[var(--primary)]" />
                                    </motion.div>
                                    <h3 className="text-2xl font-bold mb-2">Chưa có ảnh nào</h3>
                                    <p className="text-[var(--muted)] mb-8">Tải ảnh lên để bắt đầu resize</p>

                                    <div className="max-w-3xl mx-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {[
                                                { icon: MdCloudUpload, title: 'Tải lên', desc: 'Kéo thả hoặc click để chọn nhiều ảnh' },
                                                { icon: MdTune, title: 'Tùy chỉnh', desc: 'Chọn kích thước và định dạng mong muốn' },
                                                { icon: MdArchive, title: 'Tải về', desc: 'Nhận file ZIP chứa tất cả ảnh đã resize' }
                                            ].map((step, i) => (
                                                <motion.div
                                                    key={step.title}
                                                    className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--surface-lighter)]"
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.2 + i * 0.1 }}
                                                >
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-[var(--background)] font-bold">
                                                            {i + 1}
                                                        </div>
                                                        <step.icon className="text-2xl text-[var(--primary)]" />
                                                    </div>
                                                    <h4 className="font-semibold mb-1">{step.title}</h4>
                                                    <p className="text-sm text-[var(--muted)]">{step.desc}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </motion.main>
                    </div>
                </motion.div>
            </div>

            {/* Compare Modal */}
            <AnimatePresence>
                {showCompare && selectedImage && selectedImage.status === 'completed' && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCompare(false)}
                    >
                        <motion.div
                            className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden bg-white shadow-2xl p-2"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="absolute top-4 right-4 z-10 flex gap-2">
                                <button
                                    onClick={() => setShowCompare(false)}
                                    className="p-2 rounded-full bg-[var(--surface-light)] hover:bg-[var(--surface-lighter)] transition-colors"
                                >
                                    <MdClose className="text-xl" />
                                </button>
                            </div>
                            
                            <div className="rounded-2xl overflow-hidden">
                                <ReactCompareSlider
                                    itemOne={
                                        <ReactCompareSliderImage
                                            src={selectedImage.preview}
                                            alt="Original"
                                            style={{ objectFit: 'contain' }}
                                        />
                                    }
                                    itemTwo={
                                        <ReactCompareSliderImage
                                            src={selectedImage.resizedPreview!}
                                            alt="Resized"
                                            style={{ objectFit: 'contain' }}
                                        />
                                    }
                                    style={{ height: '70vh' }}
                                />
                            </div>
                            
                            <div className="flex justify-between items-center p-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-[var(--muted)]">Gốc:</span>
                                    <span className="font-medium">{selectedImage.originalSize.width}×{selectedImage.originalSize.height}</span>
                                    <span className="badge badge-warning">{formatBytes(selectedImage.file.size)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[var(--muted)]">Đã resize:</span>
                                    <span className="font-medium text-[var(--primary)]">{selectedImage.newSize.width}×{selectedImage.newSize.height}</span>
                                    {selectedImage.resizedBlob && (
                                        <span className="badge badge-success">{formatBytes(selectedImage.resizedBlob.size)}</span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ZIP Download Modal */}
            <AnimatePresence>
                {showZipModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowZipModal(false)}
                    >
                        <motion.div
                            className="relative w-full max-w-md rounded-3xl overflow-hidden bg-white shadow-2xl p-6"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]">
                                        <MdFolder className="text-2xl text-[var(--background)]" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Tải về ZIP</h3>
                                        <p className="text-sm text-[var(--muted)]">{completedImages.length} ảnh đã xử lý</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowZipModal(false)}
                                    className="p-2 rounded-full bg-[var(--surface-light)] hover:bg-[var(--surface-lighter)] transition-colors"
                                >
                                    <MdClose className="text-xl" />
                                </button>
                            </div>

                            {/* File Name Input */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    <MdEdit className="text-[var(--primary)]" />
                                    Tên file ZIP
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={zipFileName}
                                        onChange={(e) => setZipFileName(e.target.value.replace(/[^a-zA-Z0-9-_\u00C0-\u024F\u1E00-\u1EFF ]/g, ''))}
                                        placeholder="Nhập tên file..."
                                        className="input pr-12"
                                        onKeyDown={(e) => e.key === 'Enter' && downloadAsZip()}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">.zip</span>
                                </div>
                                <p className="text-xs text-[var(--muted)] mt-2">
                                    Bạn có thể dùng chữ cái, số, dấu gạch ngang và gạch dưới
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="p-4 rounded-xl bg-[var(--surface-light)] mb-6">
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-[var(--muted)]">Số ảnh:</span>
                                    <span className="font-semibold">{completedImages.length}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm mb-2">
                                    <span className="text-[var(--muted)]">Định dạng:</span>
                                    <span className="font-semibold uppercase">{resizeOptions.format}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-[var(--muted)]">Kích thước:</span>
                                    <span className="font-semibold">{resizeOptions.width}×{resizeOptions.height}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowZipModal(false)}
                                    className="flex-1 btn-secondary"
                                >
                                    Hủy
                                </button>
                                <motion.button
                                    onClick={downloadAsZip}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!zipFileName.trim()}
                                >
                                    <MdDownload />
                                    Tải về
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
