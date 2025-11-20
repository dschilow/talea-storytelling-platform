import React from 'react';
import { Home, BookOpen, User, FlaskConical } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: BookOpen, label: 'Geschichten', path: '/stories' },
        { icon: User, label: 'Avatare', path: '/avatar' },
        { icon: FlaskConical, label: 'Wissen', path: '/doku' },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
            <div className="pointer-events-auto bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/20 shadow-lg shadow-primary/5 rounded-2xl mx-auto max-w-md flex items-center justify-around p-2">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 transition-all duration-200 ${isActive(item.path)
                                ? 'text-primary bg-primary/10'
                                : 'text-muted-foreground hover:text-foreground active:scale-95'
                            }`}
                    >
                        <item.icon
                            size={24}
                            className={`mb-1 transition-transform ${isActive(item.path) ? 'scale-110' : ''}`}
                            strokeWidth={isActive(item.path) ? 2.5 : 2}
                        />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNav;
