import "./globals.css";

export const metadata = {
  title: "ChainConfess - 链上匿名告白",
  description: "FHEVM 同态加密匿名告白平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
