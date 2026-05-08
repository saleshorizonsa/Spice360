import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import SearchableSelect from "./SearchableSelect";

export default function SearchFilter({ 
    data, 
    onFilteredData, 
    searchFields = [], 
    filterOptions = [],
    placeholder = "Search..." 
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilters, setActiveFilters] = useState({});
    const [showFilters, setShowFilters] = useState(false);
    const filterRef = useRef(null);

    useEffect(() => {
        filterData();
    }, [searchQuery, activeFilters, data]);

    // Close filters when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setShowFilters(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filterData = () => {
        if (!data || data.length === 0) {
            onFilteredData([]);
            return;
        }

        let filtered = [...data];

        // Apply text search across specified fields
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            
            filtered = filtered.filter(item => {
                // Search in specified fields
                if (searchFields.length > 0) {
                    return searchFields.some(field => {
                        const value = getNestedValue(item, field);
                        if (value === null || value === undefined) return false;
                        return String(value).toLowerCase().includes(query);
                    });
                }
                
                // Search all fields if no specific fields specified
                return Object.values(item).some(value => {
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(query);
                });
            });
        }

        // Apply advanced filters
        Object.entries(activeFilters).forEach(([field, filterValue]) => {
            if (filterValue && filterValue !== "all") {
                filtered = filtered.filter(item => {
                    const itemValue = getNestedValue(item, field);
                    
                    // Handle boolean values
                    if (typeof itemValue === 'boolean') {
                        return String(itemValue) === filterValue;
                    }
                    
                    // Handle numeric values
                    if (typeof itemValue === 'number') {
                        return itemValue === Number(filterValue) || String(itemValue) === filterValue;
                    }
                    
                    // Handle string values (case-insensitive)
                    return String(itemValue).toLowerCase() === String(filterValue).toLowerCase();
                });
            }
        });

        onFilteredData(filtered);
    };

    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    const handleClearSearch = () => {
        setSearchQuery("");
        setActiveFilters({});
    };

    const handleFilterChange = (field, value) => {
        setActiveFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const activeFilterCount = Object.values(activeFilters).filter(v => v && v !== "all").length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Main Search Input */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder={placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filter Toggle Button */}
                {filterOptions.length > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="relative w-full sm:w-auto"
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </Button>
                )}

                {/* Clear All Button */}
                {(searchQuery || activeFilterCount > 0) && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearSearch}
                        className="w-full text-gray-600 hover:text-gray-900 sm:w-auto"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && filterOptions.length > 0 && (
                <div ref={filterRef} className="bg-gray-50 rounded-lg p-4 border animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filterOptions.map((filter, idx) => (
                            <SearchableSelect
                                key={idx}
                                label={filter.label}
                                value={activeFilters[filter.field] || "all"}
                                onValueChange={(value) => handleFilterChange(filter.field, value)}
                                options={[
                                    { value: "all", label: `All ${filter.label}` },
                                    ...filter.values
                                ]}
                                placeholder={`Select ${filter.label}...`}
                                searchPlaceholder={`Search ${filter.label}...`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
