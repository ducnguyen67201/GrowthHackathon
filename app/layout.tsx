import type { Metadata } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tombstone — AI SDR",
  description:
    "Your closed-lost deals aren't gone — they're tombstoned. Tombstone revives dead pipeline the moment the world changes in your favor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
