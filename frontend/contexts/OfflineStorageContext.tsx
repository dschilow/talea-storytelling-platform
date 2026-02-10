import React, { createContext, useContext } from 'react';
import { useOfflineStorage } from '../hooks/useOfflineStorage';

type OfflineStorageContextValue = ReturnType<typeof useOfflineStorage>;

const OfflineStorageContext = createContext<OfflineStorageContextValue | undefined>(undefined);

export const OfflineStorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const offlineStorage = useOfflineStorage();
  return (
    <OfflineStorageContext.Provider value={offlineStorage}>
      {children}
    </OfflineStorageContext.Provider>
  );
};

export const useOffline = (): OfflineStorageContextValue => {
  const context = useContext(OfflineStorageContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineStorageProvider');
  }
  return context;
};
