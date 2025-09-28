// src/context/UserRelationsContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserRelations } from '../hooks/useUserRelations';

const UserRelationsContext = createContext();

export const UserRelationsProvider = ({ children }) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const { relations, loading, error, calculateRelationship } = useUserRelations(currentUserId);

  return (
    <UserRelationsContext.Provider value={{
      relations,
      loading,
      error,
      calculateRelationship,
      setCurrentUserId
    }}>
      {children}
    </UserRelationsContext.Provider>
  );
};

export const useUserRelationsContext = () => {
  const context = useContext(UserRelationsContext);
  if (!context) {
    throw new Error('useUserRelationsContext must be used within UserRelationsProvider');
  }
  return context;
};