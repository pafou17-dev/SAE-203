import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cycle’Up Pyrénées",
  description: "Trois Rosalies, un même élan. Découvrez les modèles et donnez votre avis.",
  icons: {
    icon: "/assets/journey/mark.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
