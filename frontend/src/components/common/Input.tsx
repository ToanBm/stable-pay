import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-white mb-1.5 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 h-10 bg-[#002315] border border-white/10 rounded-[4px] text-sm text-white placeholder-white/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none transition-all ${className}`}
        {...props}
      />
    </div>
  );
};
