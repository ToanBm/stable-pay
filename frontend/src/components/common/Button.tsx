import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children, 
  variant = 'primary',
  isLoading, 
  className = '', 
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-[4px] text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-brand-dark focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed h-9 px-4";
  
  const variants = {
    primary: "bg-brand-primary text-white hover:bg-[#006240] border border-transparent shadow-[0_0_15px_rgba(0,123,80,0.3)] hover:shadow-[0_0_20px_rgba(0,123,80,0.5)]",
    secondary: "bg-brand-light/10 text-white hover:bg-brand-light/20 border border-transparent backdrop-blur-sm",
    outline: "bg-transparent text-white border border-white/20 hover:border-brand-primary hover:text-white",
    ghost: "bg-transparent text-white hover:text-white hover:bg-brand-light/5",
  };

  const loadingSpinner = (
    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && loadingSpinner}
      {children}
    </button>
  );
};
