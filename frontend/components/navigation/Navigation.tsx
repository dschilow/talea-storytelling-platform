import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, BookOpen } from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/', label: 'Startseite', icon: Home },
    { path: '/avatar', label: 'Avatar', icon: User },
    { path: '/story', label: 'Geschichte', icon: BookOpen },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition-colors ${
                isActive 
                  ? 'text-purple-600 bg-purple-50' 
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
