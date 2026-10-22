import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "ReviewRewards Tracker | Verified Software Review Campaigns & Gift Cards",
  description:
    "Discover active, public software review incentive campaigns on G2, Capterra, TrustRadius, and Gartner Peer Insights offering Amazon cards, Visa cards, and rewards.",
  keywords: [
    "G2 gift card",
    "Capterra review reward",
    "TrustRadius review gift card",
    "Gartner peer insights incentive",
    "software review campaigns",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
