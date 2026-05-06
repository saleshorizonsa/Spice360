import React, { useState, useRef, useEffect } from "react";

export const Popover = ({ children }) => {
    return <div className="relative inline-block">{children}</div>;
};

export const PopoverTrigger = ({ children, asChild, ...props }) => {
    return React.cloneElement(children, props);
};

export const PopoverContent = ({ 
    children, 
    className = "", 
    align = "center",
    sideOffset = 4,
    ...props 
}) => {
    const contentRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contentRef.current && !contentRef.current.contains(event.target)) {
                // Close functionality will be handled by parent
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const alignmentClass = {
        start: "left-0",
        center: "left-1/2 -translate-x-1/2",
        end: "right-0"
    }[align] || "left-0";

    return (
        <div 
            ref={contentRef}
            className={`absolute z-50 mt-2 ${alignmentClass} min-w-[280px] rounded-md border bg-white p-4 shadow-lg animate-in fade-in-0 zoom-in-95 ${className}`}
            style={{ top: `${sideOffset}px` }}
            {...props}
        >
            {children}
        </div>
    );
};