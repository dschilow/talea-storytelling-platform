import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default', 
  className = '' 
}) => {
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
  
  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    outline: 'text-foreground border border-input bg-background',
    destructive: 'border-transparent bg-destructive text-destructive-foreground'
  }
  
  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}