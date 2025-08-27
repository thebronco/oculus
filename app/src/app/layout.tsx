import { Providers } from './providers';

export const metadata = { 
  title: 'Oculus Cyber - NIST CSF Security Assessment', 
  description: 'Evaluate your organization\'s cybersecurity posture with our comprehensive NIST CSF assessment tool',
  keywords: 'NIST CSF, cybersecurity, security assessment, framework, compliance',
  authors: [{ name: 'Oculus Cyber' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3b82f6'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
