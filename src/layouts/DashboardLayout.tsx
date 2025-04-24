import React, { ReactNode } from 'react';
import Navbar from '@/components/layout/Navbar';

interface DashboardLayoutProps {
    children: ReactNode;
    showNav?: boolean;
}

export function DashboardLayout({ children, showNav = true }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-gray-50">
            {showNav && <Navbar />}
            <main className="py-4">
                {children}
            </main>
        </div>
    );
}