import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/wallet/WalletProvider";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Enviphy — Cold Chain Monitoring",
  description: "Decentralized cold chain agreement protocol on Solana",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        <SolanaWalletProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}