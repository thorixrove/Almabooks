import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Serif, Mona_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-ibm-pex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
})

const monaSans =  Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  display: "swap"
})



export const metadata: Metadata = {
  title: "Almabooks",
  description: "Ubahlah bukumu menjadi AI interaktiv. Upload PDF, dan berinteraksilah dengan bukumu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en">
      <body className={`${ibmPlexSerif.variable} ${monaSans.variable} relative font-sans antialiased`}
    >
        <ClerkProvider>
          <Navbar/>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}