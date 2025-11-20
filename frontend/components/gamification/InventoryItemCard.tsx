import React from 'react';
import { InventoryItem } from '../../types/avatar';
import { Star, Zap, Book, Shield, Users } from 'lucide-react';
import Card from '../common/Card';

interface InventoryItemCardProps {
    item: InventoryItem;
    onClick?: () => void;
}

const InventoryItemCard: React.FC<InventoryItemCardProps> = ({ item, onClick }) => {
    const getIcon = () => {
        switch (item.type) {
            case 'WEAPON': return <Zap className="w-5 h-5 text-yellow-500" />;
            case 'KNOWLEDGE': return <Book className="w-5 h-5 text-blue-500" />;
            case 'COMPANION': return <Users className="w-5 h-5 text-green-500" />;
            default: return <Shield className="w-5 h-5 text-purple-500" />;
        }
    };

    const getRarityColor = () => {
        if (item.level >= 3) return 'border-yellow-400 bg-yellow-50';
        if (item.level === 2) return 'border-blue-400 bg-blue-50';
        return 'border-gray-200 bg-white';
    };

    return (
        <div
            onClick={onClick}
            className={`relative p-4 rounded-xl border-2 transition-all transform hover:scale-105 cursor-pointer ${getRarityColor()}`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                    {getIcon()}
                </div>
                <div className="flex">
                    {[...Array(item.level)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                    ))}
                </div>
            </div>

            <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{item.name}</h4>
            <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>

            {/* Visual placeholder if no image yet */}
            <div className="mt-3 w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {/* In future: <img src={generatedImageUrl} /> */}
                <span className="text-2xl">🎁</span>
            </div>
        </div>
    );
};

export default InventoryItemCard;
