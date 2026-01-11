import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Image Resizer Pro | Resize Ảnh Chuyên Nghiệp",
  description: "Công cụ resize ảnh chuyên nghiệp. Resize nhiều ảnh cùng lúc, giữ nguyên tỉ lệ, tải về ZIP. Hỗ trợ JPG, PNG, WebP.",
  keywords: ["resize ảnh", "image resizer", "batch resize", "nén ảnh", "chỉnh sửa ảnh"],
  authors: [{ name: "Image Resizer Pro" }],
  openGraph: {
    title: "Image Resizer Pro | Resize Ảnh Chuyên Nghiệp",
    description: "Công cụ resize ảnh chuyên nghiệp. Resize nhiều ảnh cùng lúc, giữ nguyên tỉ lệ, tải về ZIP.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
