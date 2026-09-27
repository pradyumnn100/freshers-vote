import './globals.css';

export const metadata = {
  title: 'Mr. & Ms. Freshers 2026',
  description: 'Official Freshers voting portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
