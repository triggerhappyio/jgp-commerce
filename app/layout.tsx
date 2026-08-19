import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { appUrl } from "@/lib/env";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["400", "500", "600"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

const title = "JGP USA | Premium Supportive Footwear";
// "backed by 20,000+ cases" (medical-sounding) was corrected to "customers"
// elsewhere on the homepage in an earlier pass — this base metadata
// description had the same phrase and was missed then.
const description = "Premium supportive footwear engineered on biomechanics. Handcrafted in Korea, trusted by 20,000+ customers.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title, description }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <Providers>
          <Nav />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
