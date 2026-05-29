import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenuContext = React.createContext({ open: false, setOpen: () => {} });

const DropdownMenu = ({ children }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <DropdownMenuContext.Provider value={{ open, setOpen }}>
            <div className="relative inline-block">
                {children}
            </div>
        </DropdownMenuContext.Provider>
    );
};

const DropdownMenuTrigger = React.forwardRef(({ children, asChild, ...props }, ref) => {
    const { open, setOpen } = React.useContext(DropdownMenuContext);
    const child = asChild ? React.Children.only(children) : <button>{children}</button>;
    return React.cloneElement(child, {
        ref,
        onClick: (e) => {
            child.props.onClick?.(e);
            setOpen((v) => !v);
        },
    });
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = ({ children, align = "start", className, dir, ...props }) => {
    const { open, setOpen } = React.useContext(DropdownMenuContext);
    if (!open) return null;
    const alignClass = align === "end" ? "right-0" : "left-0";
    return (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
                className={cn(
                    `absolute ${alignClass} mt-2 z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-1 shadow-md`,
                    className
                )}
                dir={dir}
                {...props}
            >
                {children}
            </div>
        </>
    );
};

const DropdownMenuItem = React.forwardRef(({ children, onSelect, onClick, className, ...props }, ref) => {
    const { setOpen } = React.useContext(DropdownMenuContext);
    return (
        <div
            ref={ref}
            className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100",
                className
            )}
            onClick={(e) => {
                onClick?.(e);
                onSelect?.(e);
                setOpen(false);
            }}
            {...props}
        >
            {children}
        </div>
    );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuLabel = ({ children, className, ...props }) => (
    <div className={cn("px-2 py-1.5 text-sm font-semibold text-slate-900", className)} {...props}>
        {children}
    </div>
);

const DropdownMenuSeparator = ({ className, ...props }) => (
    <div className={cn("-mx-1 my-1 h-px bg-slate-100", className)} {...props} />
);

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
};
