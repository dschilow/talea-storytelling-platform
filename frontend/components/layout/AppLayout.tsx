import React from 'react';
import { Outlet } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const AppLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar - Only visible when signed in */}
            <SignedIn>
                <Sidebar />
            </SignedIn>

            {/* Main Content Area */}
            <main className="min-h-screen transition-all duration-300 md:ml-64">
                <div className="pb-24 md:pb-8 md:pt-8 px-4 md:px-8 max-w-[1000px] mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* Mobile Bottom Navigation - Only visible when signed in */}
            <SignedIn>
                <BottomNav />
            </SignedIn>
        </div>
    );
};

export default AppLayout;
