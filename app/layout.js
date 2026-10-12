import "./globals.css";

export const metadata = {
  title: "Maati Living — Thoughtfully chosen. Naturally better.",
  description: "Natural, useful and beautifully made things for everyday life.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
