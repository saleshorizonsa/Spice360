import React from 'react';
import { useOrganization } from '../utils/OrganizationContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function OrganizationSwitcher() {
    const { currentOrg, organizations, switchOrganization, loading } = useOrganization();

    if (loading || organizations.length <= 1) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Building2 className="w-4 h-4 text-gray-500" />
            <Select 
                value={currentOrg?.id} 
                onValueChange={switchOrganization}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                    {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                            <div className="flex flex-col">
                                <span className="font-medium">{org.organization_name}</span>
                                <span className="text-xs text-gray-500">{org.cr_number}</span>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}