import React from 'react';
import { Home, BookOpen, User, FlaskConical, Settings, LogOut, Sparkles, BookMarked, Code } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { GlassCard } from '../ui/GlassCard';

const Sidebar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useClerk();

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: User, label: 'Avatare', path: '/avatar' },
        { icon: BookOpen, label: 'Stories', path: '/stories' },
        { icon: FlaskConical, label: 'Doku', path: '/doku' },
        { icon: Sparkles, label: 'Charaktere', path: '/characters' },
        { icon: BookMarked, label: 'Märchen', path: '/fairytales' },
        { icon: Code, label: 'Logs', path: '/logs' },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 p-4 z-50">
            <GlassCard className="h-full flex flex-col !p-4 !bg-white/40 dark:!bg-black/40 backdrop-blur-xl border-white/20">
                {/* Logo / Brand */}
                <div className="flex items-center gap-3 px-4 py-6 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/20">
                        T
                    </div>
                    <span className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        Talea
                    </span>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive(item.path)
                                    ? 'bg-white/60 text-primary shadow-sm font-medium'
                                    : 'text-muted-foreground hover:bg-white/30 hover:text-foreground'
                                }`}
                        >
                            <item.icon
                                size={20}
                                className={`transition-colors ${isActive(item.path) ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                                    }`}
                            />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Bottom Actions */}
                <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
                    <button
                        onClick={() => navigate('/settings')}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-white/30 hover:text-foreground transition-all"
                    >
                        <Settings size={20} />
                        Einstellungen
                    </button>
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500/80 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                        <LogOut size={20} />
                        Abmelden
                    </button>
                </div>
            </GlassCard>
        </aside>
    );
};

export default Sidebar;
