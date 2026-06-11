import { matrixSales } from "@/api/matrixSalesClient";

/**
 * Create a notification for a user
 */
export async function createNotification({
    userEmail,
    notificationType,
    priority = 'medium',
    title,
    message,
    relatedEntity,
    relatedEntityId,
    relatedDocumentNumber,
    actionUrl,
    expiresInDays = 30,
    metadata = {}
}) {
    try {
        const notificationId = `NOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const notification = await matrixSales.entities.Notification.create({
            notification_id: notificationId,
            user_email: userEmail,
            notification_type: notificationType,
            priority,
            title,
            message,
            related_entity: relatedEntity,
            related_entity_id: relatedEntityId,
            related_document_number: relatedDocumentNumber,
            action_url: actionUrl,
            is_read: false,
            expires_at: expiresAt.toISOString(),
            metadata
        });

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(userEmails, notificationData) {
    const notifications = userEmails.map(email => ({
        ...notificationData,
        user_email: email,
        notification_id: `NOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }));

    try {
        return await matrixSales.entities.Notification.bulkCreate(notifications);
    } catch (error) {
        console.error('Error creating bulk notifications:', error);
        throw error;
    }
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
    try {
        return await matrixSales.entities.Notification.update(notificationId, {
            is_read: true,
            read_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userEmail) {
    try {
        const notifications = await matrixSales.entities.Notification.filter({
            user_email: userEmail,
            is_read: false
        });

        const updatePromises = notifications.map(n => 
            matrixSales.entities.Notification.update(n.id, {
                is_read: true,
                read_at: new Date().toISOString()
            })
        );

        return await Promise.all(updatePromises);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}

/**
 * Delete old notifications (cleanup)
 */
export async function deleteExpiredNotifications() {
    try {
        const now = new Date().toISOString();
        const expired = await matrixSales.entities.Notification.filter({
            expires_at: { $lt: now }
        });

        const deletePromises = expired.map(n => 
            matrixSales.entities.Notification.delete(n.id)
        );

        return await Promise.all(deletePromises);
    } catch (error) {
        console.error('Error deleting expired notifications:', error);
        throw error;
    }
}

/**
 * Notification templates for common scenarios
 */
export const NotificationTemplates = {
    approvalPending: (documentType, documentNumber, approverEmail) => ({
        userEmail: approverEmail,
        notificationType: 'approval_pending',
        priority: 'high',
        title: 'Approval Required',
        message: `${documentType} ${documentNumber} is pending your approval`,
        actionUrl: '/Approvals'
    }),

    approvalApproved: (documentType, documentNumber, requesterEmail) => ({
        userEmail: requesterEmail,
        notificationType: 'approval_approved',
        priority: 'medium',
        title: 'Approval Granted',
        message: `Your ${documentType} ${documentNumber} has been approved`,
        actionUrl: '/Approvals'
    }),

    approvalRejected: (documentType, documentNumber, requesterEmail, reason) => ({
        userEmail: requesterEmail,
        notificationType: 'approval_rejected',
        priority: 'high',
        title: 'Approval Rejected',
        message: `Your ${documentType} ${documentNumber} was rejected. Reason: ${reason}`,
        actionUrl: '/Approvals'
    }),

    lowStock: (materialCode, materialName, currentStock, reorderPoint, userEmail) => ({
        userEmail,
        notificationType: 'low_stock',
        priority: 'high',
        title: 'Low Stock Alert',
        message: `${materialName} (${materialCode}) is running low. Current: ${currentStock}, Reorder at: ${reorderPoint}`,
        actionUrl: '/Inventory'
    }),

    outOfStock: (materialCode, materialName, userEmail) => ({
        userEmail,
        notificationType: 'out_of_stock',
        priority: 'critical',
        title: 'Out of Stock',
        message: `${materialName} (${materialCode}) is out of stock!`,
        actionUrl: '/Inventory'
    }),

    overdueMaintenance: (assetNumber, assetName, dueDate, userEmail) => ({
        userEmail,
        notificationType: 'overdue_maintenance',
        priority: 'high',
        title: 'Maintenance Overdue',
        message: `Maintenance for ${assetName} (${assetNumber}) was due on ${dueDate}`,
        actionUrl: '/FixedAssets'
    }),

    overdueVerification: (taskName, dueDate, userEmail) => ({
        userEmail,
        notificationType: 'overdue_verification',
        priority: 'high',
        title: 'Verification Overdue',
        message: `Asset verification task "${taskName}" was due on ${dueDate}`,
        actionUrl: '/AssetVerification'
    }),

    assetAllocated: (assetNumber, assetName, allocatedTo, userEmail) => ({
        userEmail,
        notificationType: 'asset_allocated',
        priority: 'medium',
        title: 'Asset Allocated',
        message: `${assetName} (${assetNumber}) has been allocated to ${allocatedTo}`,
        actionUrl: '/FixedAssets'
    }),

    depreciationCompleted: (period, assetCount, totalDepreciation, userEmail) => ({
        userEmail,
        notificationType: 'depreciation_completed',
        priority: 'medium',
        title: 'Depreciation Run Complete',
        message: `Depreciation for period ${period} completed. ${assetCount} assets, Total: LKR ${totalDepreciation.toFixed(2)}`,
        actionUrl: '/FixedAssets'
    }),

    paymentDue: (invoiceNumber, amount, dueDate, userEmail) => ({
        userEmail,
        notificationType: 'payment_due',
        priority: 'high',
        title: 'Payment Due',
        message: `Payment for Invoice ${invoiceNumber} (LKR ${amount}) is due on ${dueDate}`,
        actionUrl: '/Finance'
    })
};