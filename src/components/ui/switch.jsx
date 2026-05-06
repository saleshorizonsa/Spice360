import * as React from "react";

export const Switch = React.forwardRef(({ checked, onCheckedChange, ...props }, ref) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            ref={ref}
            onClick={() => onCheckedChange(!checked)}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 
                focus-visible:ring-emerald-600 focus-visible:ring-offset-2
                ${checked ? 'bg-emerald-600' : 'bg-gray-200'}
            `}
            {...props}
        >
            <span
                className={`
                    pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg 
                    transform ring-0 transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0'}
                `}
            />
        </button>
    );
});

Switch.displayName = "Switch";