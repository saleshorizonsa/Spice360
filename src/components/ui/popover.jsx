import React, { useState, useRef, useEffect, useContext, createContext } from "react";
import { cn } from "@/lib/utils";

const PopoverContext = createContext(null);

export const Popover = ({ children, open: controlledOpen, onOpenChange, defaultOpen = false }) => {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const containerRef = useRef(null);

    const setOpen = (val) => {
        if (!isControlled) setInternalOpen(val);
        onOpenChange?.(val);
    };

    return (
        <PopoverContext.Provider value={{ open, setOpen, containerRef }}>
            <div ref={containerRef} className="relative inline-block">
                {children}
            </div>
        </PopoverContext.Provider>
    );
};

export const PopoverTrigger = ({ children, asChild }) => {
    const { open, setOpen } = useContext(PopoverContext);

    const handleClick = (e) => {
        e.stopPropagation();
        children.props.onClick?.(e);
        setOpen(!open);
    };

    if (asChild) {
        return React.cloneElement(children, { onClick: handleClick });
    }

    return <button onClick={handleClick}>{children}</button>;
};

export const PopoverContent = ({
    children,
    className = "",
    align = "end",
    sideOffset = 4,
    onInteractOutside,
    onEscapeKeyDown,
    onFocusOutside,
    ...props
}) => {
    const { open, setOpen, containerRef } = useContext(PopoverContext);
    const contentRef = useRef(null);

    useEffect(() => {
        if (!open) return;

        const handleMouseDown = (e) => {
            const insideContent = contentRef.current?.contains(e.target);
            const insideContainer = containerRef.current?.contains(e.target);
            if (!insideContent && !insideContainer) {
                onInteractOutside?.(e);
                setOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onEscapeKeyDown?.(e);
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, setOpen, containerRef, onInteractOutside, onEscapeKeyDown]);

    if (!open) return null;

    const alignmentClass = {
        start: "left-0",
        center: "left-1/2 -translate-x-1/2",
        end: "right-0",
    }[align] || "right-0";

    return (
        <div
            ref={contentRef}
            className={cn(
                "absolute z-50 min-w-[280px] rounded-md border bg-white shadow-lg",
                alignmentClass,
                className
            )}
            style={{ top: `calc(100% + ${sideOffset}px)` }}
            {...props}
        >
            {children}
        </div>
    );
};
