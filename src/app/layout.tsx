import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Image Resizer | Resize Ảnh Online",
  description: "Công cụ resize ảnh đơn giản. Resize nhiều ảnh cùng lúc, giữ nguyên tỉ lệ, tải về ZIP.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
