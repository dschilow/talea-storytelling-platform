import React from 'react';
import { Outlet } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { GlobalAudioPlayer } from '../audio/GlobalAudioPlayer';

const AppLayout: React.FC = () => {
    return (
        <div className="min-h-screen text-foreground flex flex-col md:flex-row">
            {/* Desktop Sidebar - Only visible when signed in */}
            <SignedIn>
                <div className="hidden md:block w-[88px] flex-shrink-0" />
                <Sidebar />
            </SignedIn>

            {/* Main Content Area */}
            <main className="flex-1 min-h-screen transition-all duration-300">
                <div className="pb-28 md:pb-10 md:pt-10 px-4 md:px-10 max-w-[1120px] mx-auto w-full">
                    <Outlet />
                </div>
            </main>

            <GlobalAudioPlayer />

            {/* Mobile Bottom Navigation - Only visible when signed in */}
            <SignedIn>
                <BottomNav />
            </SignedIn>
        </div>
    );
};

export default AppLayout;

