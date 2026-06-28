import type { Metadata } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cutthrough — AI SDR",
  description:
    "An AI SDR that figures out what a prospect cares about right now, and proves it.",
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
