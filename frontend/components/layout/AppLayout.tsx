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
            <main className="md:pl-0 transition-all duration-300 has-[aside]:md:pl-64">
                <div className="pb-24 md:pb-0"> {/* Add padding bottom for mobile nav */}
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
