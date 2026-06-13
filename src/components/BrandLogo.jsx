import React from 'react';

export default function BrandLogo({ className = '', imageClassName = '', showTagline = true }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500 shadow-sm">
        <span className="text-base font-extrabold text-amber-950">S</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-slate-900">Spice360</span>
    </div>
  );
}
