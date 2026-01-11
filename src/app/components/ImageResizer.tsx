'use client';

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { useDropzone } from 'react-dropzone';

// Presets
const PRESETS = [
  { name: 'Instagram', width: 1080, height: 1080 },
  { name: 'Story', width: 1080, height: 1920 },
  { name: 'Facebook', width: 820, height: 312 },
  { name: 'YouTube', width: 1280, height: 720 },
  { name: 'HD', width: 1280, height: 720 },
  { name: 'Full HD', width: 1920, height: 1080 },
  { name: 'Custom', width: 0, height: 0 }, // Custom - user input
];

// Common aspect ratios
const ASPECT_RATIOS = [
  { name: '1:1', ratio: 1 },
  { name: '4:3', ratio: 4 / 3 },
  { name: '3:4', ratio: 3 / 4 },
  { name: '16:9', ratio: 16 / 9 },
  { name: '9:16', ratio: 9 / 16 },
  { name: '21:9', ratio: 21 / 9 },
  { name: '3:2', ratio: 3 / 2 },
  { name: '2:3', ratio: 2 / 3 },
];

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  resizedBlob?: Blob;
  originalSize: { width: number; height: number };
  newSize: { width: number; height: number };
  status: 'pending' | 'processing' | 'completed' | 'error';
}

// Estimate file size
const estimateSize = (w: number, h: number, format: string, quality: number): number => {
  const pixels = w * h;
  const bpp = format === 'png' ? 1.2 : format === 'webp' ? 0.03 + quality * 0.22 : 0.05 + quality * 0.35;
  return Math.round(pixels * bpp);
};

// Format bytes
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function ImageResizer() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(85);
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zipName, setZipName] = useState('resized-images');
  const [showModal, setShowModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('Instagram');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>(null);

  // Get dimensions
  const getDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Dropzone
  const onDrop = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const newImages = await Promise.all(
      imageFiles.map(async (file) => {
        const dims = await getDimensions(file);
        const ratio = dims.width / dims.height;
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          preview: URL.createObjectURL(file),
          originalSize: dims,
          newSize: keepRatio ? { width, height: Math.round(width / ratio) } : { width, height },
          status: 'pending' as const,
        };
      })
    );
    setImages(prev => [...prev, ...newImages]);
  }, [width, height, keepRatio, getDimensions]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    multiple: true,
  });

  // Update sizes
  useEffect(() => {
    if (images.length > 0) {
      setImages(prev => prev.map(img => {
        const ratio = img.originalSize.width / img.originalSize.height;
        return {
          ...img,
          newSize: keepRatio ? { width, height: Math.round(width / ratio) } : { width, height },
          status: img.status === 'completed' ? 'pending' as const : img.status,
          resizedBlob: img.status === 'completed' ? undefined : img.resizedBlob,
        };
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, keepRatio]);

  // Resize image
  const resizeImage = async (img: ImageFile): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.newSize.width;
        canvas.height = img.newSize.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas error'));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Blob error')),
          `image/${format}`,
          quality / 100
        );
      };
      image.onerror = () => reject(new Error('Load error'));
      image.src = img.preview;
    });
  };

  // Process all
  const processAll = async () => {
    setIsProcessing(true);
    setProgress(0);
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'processing' as const } : x));
      try {
        const blob = await resizeImage(img);
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, resizedBlob: blob, status: 'completed' as const } : x));
      } catch {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error' as const } : x));
      }
      setProgress(((i + 1) / images.length) * 100);
    }
    setIsProcessing(false);
  };

  // Download ZIP
  const downloadZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(zipName || 'images');
    if (!folder) return;
    images.forEach(img => {
      if (img.resizedBlob) {
        folder.file(`${img.file.name.split('.')[0]}.${format}`, img.resizedBlob);
      }
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${zipName || 'images'}.zip`;
    a.click();
    setShowModal(false);
  };

  // Remove & Clear
  const removeImage = (id: string) => {
    const img = images.find(x => x.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    setImages(prev => prev.filter(x => x.id !== id));
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  // Stats
  const completed = images.filter(x => x.status === 'completed').length;
  const totalOriginal = images.reduce((a, i) => a + i.file.size, 0);
  const totalResized = images.reduce((a, i) => a + (i.resizedBlob?.size || 0), 0);
  const totalEstimated = images.reduce((a, i) => a + estimateSize(i.newSize.width, i.newSize.height, format, quality / 100), 0);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">🖼️ Image Resizer</h1>
          <p className="text-gray-500">Resize nhiều ảnh cùng lúc • Tải về ZIP</p>
        </div>

        {/* Upload */}
        <div
          {...getRootProps()}
          className={`
            p-8 md:p-12 border-2 border-dashed rounded-2xl text-center cursor-pointer mb-6
            transition-all duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}
          `}
        >
          <input {...getInputProps()} />
          <div className="text-5xl mb-4">{isDragActive ? '📂' : '📤'}</div>
          <p className="text-lg font-medium text-gray-700 mb-1">
            {isDragActive ? 'Thả ảnh vào đây!' : 'Kéo thả ảnh hoặc click để chọn'}
          </p>
          <p className="text-sm text-gray-400">JPG, PNG, WebP, GIF</p>
        </div>

        {images.length > 0 && (
          <>
            {/* Options */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              {/* Presets */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-600 mb-2">Kích thước nhanh</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setSelectedPreset(p.name);
                        if (p.name !== 'Custom') {
                          setWidth(p.width);
                          setHeight(p.height);
                          setSelectedAspectRatio(null);
                        }
                      }}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${selectedPreset === p.name
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      `}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selector (only show when Custom is selected) */}
              {selectedPreset === 'Custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Tỉ lệ phổ biến</label>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map(ar => (
                      <button
                        key={ar.name}
                        onClick={() => {
                          setSelectedAspectRatio(ar.name);
                          setKeepRatio(true); // Auto enable keep ratio when selecting aspect ratio
                          if (width > 0) {
                            setHeight(Math.round(width / ar.ratio));
                          } else if (height > 0) {
                            setWidth(Math.round(height * ar.ratio));
                          } else {
                            // Default to 1080 width if both are 0
                            setWidth(1080);
                            setHeight(Math.round(1080 / ar.ratio));
                          }
                        }}
                        className={`
                          px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                          ${selectedAspectRatio === ar.name
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                        `}
                      >
                        {ar.name}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setSelectedAspectRatio(null);
                      }}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${selectedAspectRatio === null
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                      `}
                    >
                      Tự do
                    </button>
                  </div>
                </div>
              )}

              {/* Custom */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Rộng (px)</label>
                  <input
                    type="number"
                    value={width}
                    onChange={e => {
                      const newWidth = Number(e.target.value);
                      setWidth(newWidth);
                      setSelectedPreset('Custom');
                      // Auto calculate height if aspect ratio is selected
                      if (selectedAspectRatio && keepRatio) {
                        const ratio = ASPECT_RATIOS.find(ar => ar.name === selectedAspectRatio)?.ratio;
                        if (ratio) {
                          setHeight(Math.round(newWidth / ratio));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Cao (px)</label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => {
                      const newHeight = Number(e.target.value);
                      setHeight(newHeight);
                      setSelectedPreset('Custom');
                      // Auto calculate width if aspect ratio is selected
                      if (selectedAspectRatio && keepRatio) {
                        const ratio = ASPECT_RATIOS.find(ar => ar.name === selectedAspectRatio)?.ratio;
                        if (ratio) {
                          setWidth(Math.round(newHeight * ratio));
                        }
                      }
                    }}
                    disabled={keepRatio}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Chất lượng ({quality}%)</label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Định dạng</label>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value as typeof format)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
                  >
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>
              </div>

              {/* Keep Ratio */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepRatio}
                  onChange={e => {
                    setKeepRatio(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedAspectRatio(null); // Reset aspect ratio when disabling keep ratio
                    }
                  }}
                />
                <span className="text-sm text-gray-600">Giữ nguyên tỉ lệ ảnh</span>
              </label>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Tổng ảnh</div>
                <div className="text-2xl font-bold text-gray-800">{images.length}</div>
                <div className="text-xs text-gray-400">{completed} đã xử lý</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Dung lượng gốc</div>
                <div className="text-2xl font-bold text-gray-800">{formatBytes(totalOriginal)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Dự đoán</div>
                <div className="text-2xl font-bold text-blue-500">~{formatBytes(totalEstimated)}</div>
                <div className="text-xs text-green-500">
                  {totalOriginal > 0 && `Giảm ~${Math.round((1 - totalEstimated / totalOriginal) * 100)}%`}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Thực tế</div>
                <div className="text-2xl font-bold text-green-500">
                  {completed > 0 ? formatBytes(totalResized) : '-'}
                </div>
                <div className="text-xs text-green-500">
                  {totalResized > 0 && `Giảm ${Math.round((1 - totalResized / totalOriginal) * 100)}%`}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={processAll}
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>🚀 Resize {images.length} ảnh</>
                )}
              </button>
              {completed > 0 && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-6 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all"
                >
                  📦 Tải ZIP ({completed})
                </button>
              )}
              <button
                onClick={clearAll}
                className="px-6 py-3 bg-white text-red-500 border border-red-200 font-medium rounded-xl hover:bg-red-50 transition-all ml-auto"
              >
                🗑️ Xóa tất cả
              </button>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Đang xử lý...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Image Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map(img => (
                <div key={img.id} className="bg-white rounded-xl overflow-hidden shadow-sm group">
                  <div className="relative aspect-square">
                    <img
                      src={img.preview}
                      alt={img.file.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Status */}
                    <div className={`
                      absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium
                      ${img.status === 'completed' ? 'bg-green-500 text-white' :
                        img.status === 'processing' ? 'bg-blue-500 text-white' :
                        img.status === 'error' ? 'bg-red-500 text-white' :
                        'bg-gray-200 text-gray-600'}
                    `}>
                      {img.status === 'completed' ? '✓ Xong' :
                       img.status === 'processing' ? '⏳' :
                       img.status === 'error' ? '✗ Lỗi' : 'Chờ'}
                    </div>
                    {/* Remove */}
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-700 truncate mb-2">{img.file.name}</p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Gốc:</span>
                        <span>{img.originalSize.width}×{img.originalSize.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mới:</span>
                        <span className="text-blue-500 font-medium">{img.newSize.width}×{img.newSize.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span>
                          {formatBytes(img.file.size)} →{' '}
                          <span className={img.resizedBlob ? 'text-green-500' : 'text-blue-500'}>
                            {img.resizedBlob ? formatBytes(img.resizedBlob.size) : `~${formatBytes(estimateSize(img.newSize.width, img.newSize.height, format, quality / 100))}`}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {images.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl">
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-gray-500">Chưa có ảnh nào. Kéo thả hoặc click để thêm ảnh.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">📦 Tải về ZIP</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Tên file</label>
              <input
                type="text"
                value={zipName}
                onChange={e => setZipName(e.target.value)}
                placeholder="Nhập tên file..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>Số ảnh:</span>
                <span className="font-medium">{completed}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Định dạng:</span>
                <span className="font-medium">{format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Dung lượng:</span>
                <span className="font-medium">{formatBytes(totalResized)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={downloadZip}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
              >
                Tải về
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
