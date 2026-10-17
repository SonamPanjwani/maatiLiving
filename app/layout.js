import "./globals.css";
import { CartProvider } from "@/components/cart/CartProvider";

export const metadata = {
  title: "Maati Living — Thoughtfully chosen. Naturally better.",
  description: "Natural, useful and beautifully made things for everyday life.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
