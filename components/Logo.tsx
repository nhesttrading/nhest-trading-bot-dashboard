import React from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <img 
    src="/logo.png" 
    alt="NHEST Logo" 
    className={`object-contain ${className}`} 
  />
);