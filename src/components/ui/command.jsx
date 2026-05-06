import * as React from "react";
import { Search } from "lucide-react";

const Command = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-white ${className}`}
    {...props}
  >
    {children}
  </div>
));
Command.displayName = "Command";

const CommandInput = React.forwardRef(({ className = "", ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <input
      ref={ref}
      className={`flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <div
    ref={ref}
    className={`max-h-[300px] overflow-y-auto overflow-x-hidden ${className}`}
    {...props}
  >
    {children}
  </div>
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef(({ className = "", children = "No results found.", ...props }, ref) => (
  <div
    ref={ref}
    className={`py-6 text-center text-sm text-gray-500 ${className}`}
    {...props}
  >
    {children}
  </div>
));
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = React.forwardRef(({ className = "", children, ...props }, ref) => (
  <div
    ref={ref}
    className={`overflow-hidden p-1 ${className}`}
    {...props}
  >
    {children}
  </div>
));
CommandGroup.displayName = "CommandGroup";

const CommandItem = React.forwardRef(({ className = "", children, onSelect, ...props }, ref) => (
  <div
    ref={ref}
    className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
    onClick={onSelect}
    {...props}
  >
    {children}
  </div>
));
CommandItem.displayName = "CommandItem";

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem };