import React, { useState, useRef, useEffect } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";

export default function SearchableSelect({
    label,
    value,
    onValueChange,
    options = [],
    placeholder = "Select an option...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
    noResultsMessage = "No results found.",
    createOptionLabel = "Create Item",
    showCreateOption = false,
    onCreateOption
}) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef(null);

    // Recalculate dropdown position every time it opens, and keep it synced on scroll/resize
    useEffect(() => {
        if (!open) return;

        const updatePosition = () => {
            if (!buttonRef.current) return;
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropdownHeight = Math.min(300, spaceBelow - 8);
            setDropdownStyle({
                top:    rect.bottom + 4,
                left:   rect.left,
                width:  rect.width,
                maxHeight: dropdownHeight > 80 ? dropdownHeight : 300,
            });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open]);

    const filteredOptions = options.filter(option => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        return (
            option.label.toLowerCase().includes(searchLower) ||
            option.value.toLowerCase().includes(searchLower)
        );
    });

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative">
            {label && <Label className="mb-2 block">{label}</Label>}
            <Button
                ref={buttonRef}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
                onClick={() => setOpen(!open)}
            >
                {selectedOption ? selectedOption.label : placeholder}
                <svg
                    className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </Button>
            {open && (
                <>
                    {/* Full-screen backdrop to close on outside click */}
                    <div
                        className="fixed inset-0"
                        style={{ zIndex: 9998 }}
                        onClick={() => { setOpen(false); setSearchQuery(""); }}
                    />
                    {/* Dropdown — position: fixed escapes overflow:auto clipping */}
                    <div
                        style={{ ...dropdownStyle, position: 'fixed', zIndex: 9999 }}
                        className="rounded-md border bg-white shadow-lg overflow-hidden"
                    >
                        <Command>
                            <CommandInput
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onInput={(e) => setSearchQuery(e.target.value)}
                            />
                            <CommandList style={{ maxHeight: dropdownStyle.maxHeight ? dropdownStyle.maxHeight - 48 : 240 }}>
                                {filteredOptions.length === 0 ? (
                                    <CommandEmpty>
                                        <div className="space-y-2 py-2 text-center">
                                            <p className="text-sm text-slate-500">
                                                {options.length === 0 ? emptyMessage : noResultsMessage}
                                            </p>
                                            {showCreateOption && onCreateOption && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mx-auto text-emerald-700 hover:text-emerald-800"
                                                    onClick={() => {
                                                        onCreateOption(searchQuery);
                                                        setOpen(false);
                                                        setSearchQuery("");
                                                    }}
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    {createOptionLabel}
                                                </Button>
                                            )}
                                        </div>
                                    </CommandEmpty>
                                ) : (
                                    <>
                                    <CommandGroup>
                                        {filteredOptions.map((option) => (
                                            <CommandItem
                                                key={option.value}
                                                onSelect={() => {
                                                    onValueChange(option.value);
                                                    setOpen(false);
                                                    setSearchQuery("");
                                                }}
                                            >
                                                <Check
                                                    className={`mr-2 h-4 w-4 ${
                                                        value === option.value ? "opacity-100" : "opacity-0"
                                                    }`}
                                                />
                                                {option.label}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    {showCreateOption && onCreateOption && (
                                        <CommandGroup>
                                            <CommandItem
                                                onSelect={() => {
                                                    onCreateOption(searchQuery);
                                                    setOpen(false);
                                                    setSearchQuery("");
                                                }}
                                                className="text-emerald-700"
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                {createOptionLabel}
                                            </CommandItem>
                                        </CommandGroup>
                                    )}
                                    </>
                                )}
                            </CommandList>
                        </Command>
                    </div>
                </>
            )}
        </div>
    );
}
