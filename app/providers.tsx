'use client'

import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '../contexts/AuthContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import Navbar from '../components/Navbar'
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <LanguageProvider>
          <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <Navbar />
            <Toaster position="top-center" />
            <main className="pt-16">
              {children}
            </main>
          </div>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
