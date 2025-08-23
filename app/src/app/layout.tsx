// app/src/app/layout.tsx
export const metadata = { title: 'Oculus Cyber', description: 'NIST CSF quick check' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
