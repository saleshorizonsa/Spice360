import { matrixSales } from "@/api/matrixSalesClient";

/**
 * Audit Trail Utility
 * Provides functions for logging all changes to key entities
 */

/**
 * Log an audit trail entry
 * @param {Object} params - Audit parameters
 * @param {string} params.entityType - Type of entity (e.g., 'sales_order', 'journal_entry')
 * @param {string} params.entityId - ID of the entity record
 * @param {string} params.documentNumber - Document number for easy reference
 * @param {string} params.actionType - Type of action ('create', 'update', 'delete', etc.)
 * @param {Object} params.beforeData - Data before the change (for updates)
 * @param {Object} params.afterData - Data after the change
 * @param {string} params.reason - Optional reason for the change
 * @param {Object} params.user - Current user object
 * @param {string} params.severity - Severity level ('info', 'warning', 'critical')
 */
export async function logAuditTrail({
    entityType,
    entityId,
    documentNumber,
    actionType,
    beforeData = null,
    afterData = null,
    reason = null,
    user = null,
    severity = 'info',
    relatedDocumentType = null,
    relatedDocumentId = null
}) {
    try {
        // Get current user if not provided
        if (!user) {
            try {
                user = await matrixSales.auth.me();
            } catch (error) {
                console.error('Could not get current user for audit trail:', error);
                return null;
            }
        }

        // Calculate changes
        const fieldsChanged = [];
        const changes = {};
        let changeSummary = '';

        if (beforeData && afterData) {
            // Compare before and after to identify changed fields
            const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
            
            allKeys.forEach(key => {
                // Skip system fields
                if (['id', 'created_date', 'updated_date', 'created_by'].includes(key)) {
                    return;
                }

                const before = beforeData[key];
                const after = afterData[key];

                // Check if values are different
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    fieldsChanged.push(key);
                    if (!changes.before) changes.before = {};
                    if (!changes.after) changes.after = {};
                    changes.before[key] = before;
                    changes.after[key] = after;
                }
            });

            // Create human-readable summary
            if (fieldsChanged.length > 0) {
                changeSummary = `Updated ${fieldsChanged.length} field(s): ${fieldsChanged.join(', ')}`;
            }
        } else if (actionType === 'create') {
            changeSummary = `Created new ${entityType.replace('_', ' ')}`;
        } else if (actionType === 'delete') {
            changeSummary = `Deleted ${entityType.replace('_', ' ')}`;
        } else if (['approve', 'reject', 'cancel', 'post', 'reverse'].includes(actionType)) {
            changeSummary = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)}ed ${entityType.replace('_', ' ')}`;
        }

        // Create audit trail entry
        const auditEntry = {
            audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            entity_type: entityType,
            entity_id: entityId,
            document_number: documentNumber || entityId,
            action_type: actionType,
            action_timestamp: new Date().toISOString(),
            user_email: user.email,
            user_name: user.full_name || user.email,
            user_role: user.role || 'user',
            branch_code: user.branch_code || null,
            department: user.department || null,
            changes: Object.keys(changes).length > 0 ? changes : null,
            fields_changed: fieldsChanged,
            change_summary: changeSummary,
            reason: reason,
            severity: severity,
            related_document_type: relatedDocumentType,
            related_document_id: relatedDocumentId,
            is_system_action: false
        };

        // Save to database
        const result = await matrixSales.entities.AuditTrail.create(auditEntry);
        return result;

    } catch (error) {
        console.error('Error logging audit trail:', error);
        // Don't throw error - audit trail failures shouldn't break operations
        return null;
    }
}

/**
 * Log multiple audit trail entries (for bulk operations)
 */
export async function logBulkAuditTrail(entries) {
    try {
        const user = await matrixSales.auth.me();
        
        const auditEntries = entries.map(entry => ({
            audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            action_timestamp: new Date().toISOString(),
            user_email: user.email,
            user_name: user.full_name || user.email,
            user_role: user.role || 'user',
            branch_code: user.branch_code || null,
            department: user.department || null,
            is_system_action: false,
            severity: 'info',
            ...entry
        }));

        await matrixSales.entities.AuditTrail.bulkCreate(auditEntries);
    } catch (error) {
        console.error('Error logging bulk audit trail:', error);
    }
}

/**
 * Get audit trail for a specific entity
 */
export async function getAuditTrailForEntity(entityType, entityId) {
    try {
        const trails = await matrixSales.entities.AuditTrail.filter({
            entity_type: entityType,
            entity_id: entityId
        }, '-action_timestamp');

        return trails || [];
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        return [];
    }
}

/**
 * Get audit trail for a specific document number
 */
export async function getAuditTrailForDocument(documentNumber) {
    try {
        const trails = await matrixSales.entities.AuditTrail.filter({
            document_number: documentNumber
        }, '-action_timestamp');

        return trails || [];
    } catch (error) {
        console.error('Error fetching audit trail:', error);
        return [];
    }
}

/**
 * Get audit trail for a specific user
 */
export async function getAuditTrailForUser(userEmail, limit = 100) {
    try {
        const trails = await matrixSales.entities.AuditTrail.filter({
            user_email: userEmail
        }, '-action_timestamp', limit);

        return trails || [];
    } catch (error) {
        console.error('Error fetching user audit trail:', error);
        return [];
    }
}

/**
 * Get recent audit trails (for admin dashboard)
 */
export async function getRecentAuditTrails(limit = 100) {
    try {
        const trails = await matrixSales.entities.AuditTrail.list('-action_timestamp', limit);
        return trails || [];
    } catch (error) {
        console.error('Error fetching recent audit trails:', error);
        return [];
    }
}

/**
 * Get critical audit trails (for security monitoring)
 */
export async function getCriticalAuditTrails(limit = 50) {
    try {
        const trails = await matrixSales.entities.AuditTrail.filter({
            severity: 'critical'
        }, '-action_timestamp', limit);

        return trails || [];
    } catch (error) {
        console.error('Error fetching critical audit trails:', error);
        return [];
    }
}

/**
 * Helper function to format field name for display
 */
export function formatFieldName(fieldName) {
    return fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Helper function to format action type for display
 */
export function formatActionType(actionType) {
    const actionMap = {
        create: 'Created',
        update: 'Updated',
        delete: 'Deleted',
        approve: 'Approved',
        reject: 'Rejected',
        cancel: 'Cancelled',
        post: 'Posted',
        reverse: 'Reversed',
        submit: 'Submitted',
        complete: 'Completed',
        close: 'Closed'
    };
    return actionMap[actionType] || actionType;
}

/**
 * Helper function to get action color
 */
export function getActionColor(actionType) {
    const colorMap = {
        create: 'text-green-600',
        update: 'text-blue-600',
        delete: 'text-red-600',
        approve: 'text-emerald-600',
        reject: 'text-red-600',
        cancel: 'text-orange-600',
        post: 'text-indigo-600',
        reverse: 'text-purple-600',
        submit: 'text-blue-600',
        complete: 'text-green-600',
        close: 'text-gray-600'
    };
    return colorMap[actionType] || 'text-gray-600';
}