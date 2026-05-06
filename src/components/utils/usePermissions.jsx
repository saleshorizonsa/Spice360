import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Custom hook to check user permissions
 * Usage: const { hasPermission, isAdmin, loading, userRoles } = usePermissions();
 * Then: hasPermission('finance.fixed_asset', 'create')
 */
export function usePermissions() {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRoles, setUserRoles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserAndRoles = async () => {
            try {
                const user = await base44.auth.me();
                setCurrentUser(user);

                // Fetch user's assigned roles
                if (user.assigned_roles && user.assigned_roles.length > 0) {
                    const roles = await Promise.all(
                        user.assigned_roles.map(roleCode => 
                            base44.entities.Role.filter({ role_code: roleCode })
                        )
                    );
                    setUserRoles(roles.flat().filter(r => r.status === 'active'));
                } else {
                    setUserRoles([]);
                }
            } catch (error) {
                console.error('Error fetching user permissions:', error);
                setUserRoles([]);
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndRoles();
    }, []);

    /**
     * Check if user has a specific permission
     * @param {string} module - Module path (e.g., 'finance.fixed_asset', 'inventory.stock_movement')
     * @param {string} action - Action (e.g., 'view', 'create', 'edit', 'delete', 'approve')
     * @returns {boolean}
     */
    const hasPermission = (module, action) => {
        // Admins have all permissions
        if (currentUser?.role === 'admin') return true;

        // If no roles assigned, deny access (except admins)
        if (!userRoles || userRoles.length === 0) return false;

        // Check if any of the user's roles has the permission
        return userRoles.some(role => {
            if (!role.permissions) return false;

            const moduleParts = module.split('.');
            let permissionObj = role.permissions;

            // Navigate through nested permission object
            for (const part of moduleParts) {
                if (!permissionObj[part]) return false;
                permissionObj = permissionObj[part];
            }

            // Check the specific action
            return permissionObj[action] === true;
        });
    };

    /**
     * Check if user is an admin
     */
    const isAdmin = currentUser?.role === 'admin';

    /**
     * Check if user has any permission in a module
     */
    const hasAnyPermission = (module) => {
        if (isAdmin) return true;
        
        return userRoles.some(role => {
            if (!role.permissions) return false;

            const moduleParts = module.split('.');
            let permissionObj = role.permissions;

            for (const part of moduleParts) {
                if (!permissionObj[part]) return false;
                permissionObj = permissionObj[part];
            }

            // Check if any action is true
            return Object.values(permissionObj).some(val => val === true);
        });
    };

    /**
     * Get user's role names
     */
    const getRoleNames = () => {
        if (isAdmin) return ['System Administrator'];
        return userRoles.map(r => r.role_name);
    };

    return {
        hasPermission,
        hasAnyPermission,
        isAdmin,
        loading,
        userRoles,
        currentUser,
        getRoleNames
    };
}

/**
 * Permission-aware wrapper component
 * Usage: <PermissionGate module="finance.fixed_asset" action="create">
 *          <Button>Create Asset</Button>
 *        </PermissionGate>
 */
export function PermissionGate({ module, action, children, fallback = null }) {
    const { hasPermission, loading } = usePermissions();

    if (loading) return null;
    if (!hasPermission(module, action)) return fallback;

    return children;
}

/**
 * Check permission utility function (for use outside components)
 */
export async function checkPermission(module, action) {
    try {
        const user = await base44.auth.me();
        
        // Admins have all permissions
        if (user.role === 'admin') return true;

        // Fetch user's roles
        if (!user.assigned_roles || user.assigned_roles.length === 0) return false;

        const roles = await Promise.all(
            user.assigned_roles.map(roleCode => 
                base44.entities.Role.filter({ role_code: roleCode })
            )
        );

        const activeRoles = roles.flat().filter(r => r.status === 'active');

        return activeRoles.some(role => {
            if (!role.permissions) return false;

            const moduleParts = module.split('.');
            let permissionObj = role.permissions;

            for (const part of moduleParts) {
                if (!permissionObj[part]) return false;
                permissionObj = permissionObj[part];
            }

            return permissionObj[action] === true;
        });
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}