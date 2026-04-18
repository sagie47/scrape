import "../client/src/index.css";

export const metadata = {
  title: "Scrape",
  description: "Lead scraping and CRO audit workflow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
