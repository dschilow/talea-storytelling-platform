import React, { useState } from 'react';
import { InventoryItem } from '../../types/avatar';
import InventoryItemCard from './InventoryItemCard';
import ArtifactDetailModal from './ArtifactDetailModal';
import { PackageOpen } from 'lucide-react';
import FadeInView from '../animated/FadeInView';

interface TreasureRoomProps {
    items: InventoryItem[];
}

const TreasureRoom: React.FC<TreasureRoomProps> = ({ items }) => {
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleItemClick = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedItem(null), 300); // Clear after animation
    };

    if (!items || items.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PackageOpen className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Die Schatzkammer ist leer</h3>
                <p className="text-gray-500 max-w-sm mx-auto">
                    Lies Geschichten, um magische Gegenstände und Wissen zu sammeln!
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item, index) => (
                    <FadeInView key={item.id} delay={index * 50}>
                        <InventoryItemCard 
                            item={item} 
                            onClick={() => handleItemClick(item)}
                        />
                    </FadeInView>
                ))}
            </div>

            {/* Artifact Detail Modal */}
            <ArtifactDetailModal
                item={selectedItem}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                showStoryLink={true}
            />
        </>
    );
};

export default TreasureRoom;
