import React from 'react';
import { Outlet } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const AppLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
            {/* Desktop Sidebar - Only visible when signed in */}
            <SignedIn>
                <Sidebar />
            </SignedIn>

            {/* Main Content Area */}
            <main className="flex-1 min-h-screen transition-all duration-300">
                <div className="pb-24 md:pb-8 md:pt-8 px-4 md:px-8 max-w-[1000px] mx-auto w-full">
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
