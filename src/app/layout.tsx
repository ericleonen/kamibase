import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Providers from "./Providers";
import AuthProvider from "@/auth/AuthProvider";
import Shadow from "./components/Shadow";

const inter = Montserrat({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KamiBase",
  description: "Save your crease patterns"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            {children}
            <Shadow />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
