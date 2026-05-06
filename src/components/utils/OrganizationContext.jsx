import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const OrganizationContext = createContext();

export const useOrganization = () => {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error('useOrganization must be used within OrganizationProvider');
    }
    return context;
};

export const OrganizationProvider = ({ children }) => {
    const [currentOrg, setCurrentOrg] = useState(null);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        initializeOrganization();
    }, []);

    const initializeOrganization = async () => {
        try {
            // Get current user
            const currentUser = await base44.auth.me();
            setUser(currentUser);

            // Get all organizations
            const orgs = await base44.entities.Organization.list();
            setOrganizations(orgs);

            // Get user's last selected organization from localStorage
            const savedOrgId = localStorage.getItem('selected_organization_id');
            
            let selectedOrg = null;
            if (savedOrgId) {
                selectedOrg = orgs.find(org => org.id === savedOrgId);
            }
            
            // If no saved org or it doesn't exist, use first active org
            if (!selectedOrg && orgs.length > 0) {
                selectedOrg = orgs.find(org => org.status === 'active') || orgs[0];
            }

            if (selectedOrg) {
                setCurrentOrg(selectedOrg);
                localStorage.setItem('selected_organization_id', selectedOrg.id);
            }
        } catch (error) {
            console.error('Error initializing organization:', error);
        } finally {
            setLoading(false);
        }
    };

    const switchOrganization = (orgId) => {
        const org = organizations.find(o => o.id === orgId);
        if (org) {
            setCurrentOrg(org);
            localStorage.setItem('selected_organization_id', orgId);
            // Reload page to refresh all data for new organization
            window.location.reload();
        }
    };

    // Helper function to add organization filter to queries
    const withOrgFilter = (filters = {}) => {
        if (!currentOrg) return filters;
        return {
            ...filters,
            organization_id: currentOrg.id
        };
    };

    const value = {
        currentOrg,
        organizations,
        loading,
        user,
        switchOrganization,
        withOrgFilter
    };

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    );
};