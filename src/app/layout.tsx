import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTP Login - Message Central",
  description: "Login with OTP using Message Central",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
