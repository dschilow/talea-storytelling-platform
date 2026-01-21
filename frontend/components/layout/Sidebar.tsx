import React, { useState } from 'react';
import { Home, BookOpen, User, FlaskConical, Settings, LogOut, Sparkles, Gem, BookMarked, Code } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { Sidebar as AceternitySidebar, SidebarBody, SidebarLink } from '../ui/sidebar';
import { useTranslation } from 'react-i18next';

const Sidebar: React.FC = () => {
    const { signOut } = useClerk();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const navItems = [
        { icon: <Home className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.home'), href: '/' },
        { icon: <User className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.avatars'), href: '/avatar' },
        { icon: <BookOpen className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.stories'), href: '/stories' },
        { icon: <FlaskConical className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.doku'), href: '/doku' },
        { icon: <Sparkles className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.characters'), href: '/characters' },
        { icon: <Gem className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.artifacts'), href: '/artifacts' },
        { icon: <BookMarked className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.fairytales'), href: '/fairytales' },
        { icon: <Code className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />, label: t('navigation.logs'), href: '/logs' },
    ];

    return (
        <div className="hidden md:flex h-screen sticky top-0 left-0 z-50">
            <AceternitySidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-r border-white/20">
                    <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {/* Logo */}
                        <div className="flex items-center gap-2 px-1 py-4 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex-shrink-0 flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
                                T
                            </div>
                            {open && (
                                <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-pre">
                                    Talea
                                </span>
                            )}
                        </div>

                        {/* Links */}
                        <div className="flex flex-col gap-2">
                            {navItems.map((item, idx) => (
                                <SidebarLink key={idx} link={item} />
                            ))}
                        </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex flex-col gap-2">
                        <SidebarLink
                            link={{
                                label: t('navigation.settings'),
                                href: "/settings",
                                icon: <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />,
                            }}
                        />
                        <div onClick={() => signOut()} className="cursor-pointer">
                            <SidebarLink
                                link={{
                                    label: t('navigation.logout'),
                                    href: "#",
                                    icon: <LogOut className="text-red-500 h-5 w-5 flex-shrink-0" />,
                                }}
                            />
                        </div>
                    </div>
                </SidebarBody>
            </AceternitySidebar>
        </div>
    );
};

export default Sidebar;
