import React from 'react';
import { Home, BookOpen, User, FlaskConical, Sparkles, Gem, BookMarked, Code } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const navItems = [
        { icon: Home, label: t('navigation.home'), path: '/' },
        { icon: User, label: t('navigation.avatars'), path: '/avatar' },
        { icon: BookOpen, label: t('navigation.stories'), path: '/stories' },
        { icon: FlaskConical, label: t('navigation.doku'), path: '/doku' },
        { icon: Sparkles, label: t('navigation.characters'), path: '/characters' },
        { icon: Gem, label: t('navigation.artifacts'), path: '/artifacts' },
        { icon: BookMarked, label: t('navigation.fairytales'), path: '/fairytales' },
        { icon: Code, label: t('navigation.logs'), path: '/logs' },
    ];

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-2 pointer-events-none">
            <div className="pointer-events-auto bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-white/20 shadow-lg shadow-primary/5 rounded-2xl mx-auto max-w-full flex items-center justify-between px-2 py-2 overflow-x-auto">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center justify-center p-1.5 rounded-xl min-w-[3.5rem] transition-all duration-200 ${isActive(item.path)
                                ? 'text-primary bg-primary/10'
                                : 'text-muted-foreground hover:text-foreground active:scale-95'
                            }`}
                    >
                        <item.icon
                            size={20}
                            className={`mb-0.5 transition-transform ${isActive(item.path) ? 'scale-110' : ''}`}
                            strokeWidth={isActive(item.path) ? 2.5 : 2}
                        />
                        <span className="text-[9px] font-medium truncate w-full text-center">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNav;
