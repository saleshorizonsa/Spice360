import * as React from "react";

const DropdownMenu = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="relative inline-block">
            {React.Children.map(children, child =>
                React.cloneElement(child, { open, setOpen })
            )}
        </div>
    );
};

const DropdownMenuTrigger = React.forwardRef(({ children, asChild, open, setOpen }, ref) => {
    const child = asChild ? React.Children.only(children) : <button>{children}</button>;
    return React.cloneElement(child, {
        ref,
        onClick: () => setOpen(!open)
    });
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = ({ children, align = "start", open, setOpen }) => {
    if (!open) return null;
    
    const alignClass = align === "end" ? "right-0" : "left-0";
    
    return (
        <>
            <div 
                className="fixed inset-0 z-40" 
                onClick={() => setOpen(false)}
            />
            <div className={`absolute ${alignClass} mt-2 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white shadow-md animate-in fade-in-80`}>
                {children}
            </div>
        </>
    );
};

const DropdownMenuItem = React.forwardRef(({ children, onClick, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 transition-colors"
            onClick={onClick}
            {...props}
        >
            {children}
        </div>
    );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export { 
    DropdownMenu, 
    DropdownMenuTrigger, 
    DropdownMenuContent, 
    DropdownMenuItem 
};