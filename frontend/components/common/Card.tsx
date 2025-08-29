import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  onPress?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onPress
}) => {
  const baseClasses = 'rounded-lg transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-gray-50',
    elevated: 'bg-white shadow-md hover:shadow-lg',
    outlined: 'bg-white border border-gray-200'
  };

  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  };

  const interactiveClasses = onPress ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : '';

  const Component = onPress ? 'button' : 'div';

  return (
    <Component
      onClick={onPress}
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${interactiveClasses} ${className}`}
    >
      {children}
    </Component>
  );
};

export default Card;
