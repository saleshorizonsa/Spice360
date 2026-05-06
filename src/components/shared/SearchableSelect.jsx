import React, { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";

export default function SearchableSelect({ 
    label, 
    value, 
    onValueChange, 
    options = [],
    placeholder = "Select an option...",
    searchPlaceholder = "Search..."
}) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

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
                    <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
                        <Command>
                            <CommandInput
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onInput={(e) => setSearchQuery(e.target.value)}
                            />
                            <CommandList>
                                {filteredOptions.length === 0 ? (
                                    <CommandEmpty>No results found.</CommandEmpty>
                                ) : (
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
                                )}
                            </CommandList>
                        </Command>
                    </div>
                </>
            )}
        </div>
    );
}