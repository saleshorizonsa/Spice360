
import { matrixSales } from "@/api/matrixSalesClient";
import { createNotification } from "./notificationService";

/**
 * Approval Workflow Utility
 * Handles multi-level approval logic for various document types
 */

/**
 * Get applicable approval matrix for a document
 */
export async function getApplicableApprovalMatrix(documentType, amount, branch = null, department = null) {
    try {
        const matrices = await matrixSales.entities.ApprovalMatrix.filter({
            document_type: documentType,
            status: 'active'
        });

        // Filter by branch and department if provided
        let applicableMatrices = matrices.filter(matrix => {
            const branchMatch = !matrix.branch_code || matrix.branch_code === 'ALL' || matrix.branch_code === branch;
            const deptMatch = !matrix.department || matrix.department === department;
            const amountMatch = amount >= (matrix.threshold_min || 0) && 
                              (!matrix.threshold_max || amount <= matrix.threshold_max);
            return branchMatch && deptMatch && amountMatch;
        });

        // Sort by approval level
        applicableMatrices.sort((a, b) => a.approval_level - b.approval_level);

        return applicableMatrices;
    } catch (error) {
        console.error('Error getting approval matrix:', error);
        return [];
    }
}

/**
 * Create approval request for a document
 */
export async function createApprovalRequest(documentData) {
    const {
        documentType,
        documentNumber,
        documentId,
        amount,
        requestedBy,
        requestedByName,
        requestedByRole,
        branch,
        department,
        summary
    } = documentData;

    try {
        // Get approval matrix
        const approvalMatrix = await getApplicableApprovalMatrix(documentType, amount, branch, department);

        if (!approvalMatrix || approvalMatrix.length === 0) {
            // No approval required
            return null;
        }

        // Build approval chain
        const approvalChain = approvalMatrix.map(matrix => ({
            level: matrix.approval_level,
            role: matrix.required_role,
            approver_email: null, // Will be assigned dynamically
            approver_name: null,
            status: 'pending',
            action_date: null,
            comments: null
        }));

        // Get first level approver
        const firstLevelMatrix = approvalMatrix[0];
        const firstApprover = await findApproverByRole(firstLevelMatrix.required_role, branch, department);

        // Create approval request
        const requestId = `AR-${Date.now()}`;
        const approvalRequest = await matrixSales.entities.ApprovalRequest.create({
            request_id: requestId,
            document_type: documentType,
            document_number: documentNumber,
            document_id: documentId,
            request_date: new Date().toISOString(),
            requested_by: requestedBy,
            requested_by_name: requestedByName,
            requested_by_role: requestedByRole,
            document_amount: amount,
            approval_level: 1,
            total_levels_required: approvalMatrix.length,
            current_approver_role: firstLevelMatrix.required_role,
            current_approver_email: firstApprover?.email,
            current_approver_name: firstApprover?.full_name,
            status: 'pending',
            current_level_status: 'pending',
            approval_chain: approvalChain,
            document_summary: summary,
            branch_code: branch,
            department: department,
            priority: amount > 100000 ? 'high' : 'normal'
        });

        // Notify first approver
        if (firstApprover?.email) {
            createNotification({
                userEmail:             firstApprover.email,
                notificationType:      'approval_pending',
                priority:              'high',
                title:                 'Approval Required',
                message:               `${documentType.replace(/_/g, ' ')} ${documentNumber} is pending your approval`,
                relatedEntity:         documentType,
                relatedDocumentNumber: documentNumber,
                actionUrl:             '/Approvals',
            }).catch(() => {});
        }

        return approvalRequest;
    } catch (error) {
        console.error('Error creating approval request:', error);
        throw error;
    }
}

/**
 * Find approver by role
 */
async function findApproverByRole(role, branch = null, department = null) {
    try {
        const users = await matrixSales.entities.User.filter({
            approval_role: role,
            status: 'active'
        });

        // Prefer users from same branch/department
        if (users.length > 0) {
            const branchUser = users.find(u => u.branch_code === branch);
            if (branchUser) return branchUser;

            const deptUser = users.find(u => u.department === department);
            if (deptUser) return deptUser;

            return users[0]; // Return any active user with the role
        }

        return null;
    } catch (error) {
        console.error('Error finding approver:', error);
        return null;
    }
}

/**
 * Process approval action (approve/reject)
 */
export async function processApprovalAction(requestId, action, comments, approverEmail, approverName) {
    try {
        const { logAuditTrail } = await import('./auditTrail');
        
        const request = await matrixSales.entities.ApprovalRequest.filter({ request_id: requestId });
        if (!request || request.length === 0) {
            throw new Error('Approval request not found');
        }

        const approvalRequest = request[0];
        const currentLevel = approvalRequest.approval_level;
        const approvalChain = approvalRequest.approval_chain || [];

        // Update current level in chain
        const updatedChain = approvalChain.map(level => {
            if (level.level === currentLevel) {
                return {
                    ...level,
                    approver_email: approverEmail,
                    approver_name: approverName,
                    status: action === 'approve' ? 'approved' : 'rejected',
                    action_date: new Date().toISOString(),
                    comments: comments
                };
            }
            return level;
        });

        if (action === 'reject') {
            // Rejection - update request status
            await matrixSales.entities.ApprovalRequest.update(approvalRequest.id, {
                status: 'rejected',
                current_level_status: 'rejected',
                rejected_by: approverEmail,
                rejected_date: new Date().toISOString(),
                rejection_reason: comments,
                approval_chain: updatedChain
            });

            // Update source document status to rejected
            await updateDocumentStatus(approvalRequest.document_type, approvalRequest.document_id, 'rejected');
            
            // Log audit trail for rejection
            await logAuditTrail({
                entityType: approvalRequest.document_type,
                entityId: approvalRequest.document_id,
                documentNumber: approvalRequest.document_number,
                actionType: 'reject',
                afterData: { status: 'rejected' },
                reason: comments,
                severity: 'warning',
                relatedDocumentType: 'approval_request',
                relatedDocumentId: approvalRequest.id
            });

            // Notify requester of rejection
            if (approvalRequest.requested_by) {
                createNotification({
                    userEmail:             approvalRequest.requested_by,
                    notificationType:      'approval_rejected',
                    priority:              'high',
                    title:                 'Approval Rejected',
                    message:               `Your ${approvalRequest.document_type.replace(/_/g, ' ')} ${approvalRequest.document_number} was rejected${comments ? `: ${comments}` : ''}`,
                    relatedEntity:         approvalRequest.document_type,
                    relatedDocumentNumber: approvalRequest.document_number,
                    actionUrl:             '/Approvals',
                }).catch(() => {});
            }

            return {
                status: 'rejected',
                message: 'Document rejected'
            };
        }

        // Approval
        if (currentLevel >= approvalRequest.total_levels_required) {
            // Final approval
            await matrixSales.entities.ApprovalRequest.update(approvalRequest.id, {
                status: 'approved',
                current_level_status: 'approved',
                approved_by: approverEmail,
                approved_date: new Date().toISOString(),
                approval_chain: updatedChain
            });

            // Update source document status to approved
            await updateDocumentStatus(approvalRequest.document_type, approvalRequest.document_id, 'approved');
            
            // Log audit trail for final approval
            await logAuditTrail({
                entityType: approvalRequest.document_type,
                entityId: approvalRequest.document_id,
                documentNumber: approvalRequest.document_number,
                actionType: 'approve',
                afterData: { status: 'approved' },
                reason: comments,
                severity: 'info',
                relatedDocumentType: 'approval_request',
                relatedDocumentId: approvalRequest.id
            });

            // Notify requester of final approval
            if (approvalRequest.requested_by) {
                createNotification({
                    userEmail:             approvalRequest.requested_by,
                    notificationType:      'approval_approved',
                    priority:              'medium',
                    title:                 'Approved',
                    message:               `Your ${approvalRequest.document_type.replace(/_/g, ' ')} ${approvalRequest.document_number} has been approved`,
                    relatedEntity:         approvalRequest.document_type,
                    relatedDocumentNumber: approvalRequest.document_number,
                    actionUrl:             '/Approvals',
                }).catch(() => {});
            }

            return {
                status: 'approved',
                message: 'Document fully approved',
                finalApproval: true
            };
        } else {
            // Move to next level
            const nextLevel = currentLevel + 1;
            const nextLevelChain = approvalChain.find(l => l.level === nextLevel);
            const nextApprover = await findApproverByRole(
                nextLevelChain.role,
                approvalRequest.branch_code,
                approvalRequest.department
            );

            await matrixSales.entities.ApprovalRequest.update(approvalRequest.id, {
                approval_level: nextLevel,
                current_approver_role: nextLevelChain.role,
                current_approver_email: nextApprover?.email,
                current_approver_name: nextApprover?.full_name,
                current_level_status: 'pending',
                approval_chain: updatedChain
            });
            
            // Log audit trail for level approval
            await logAuditTrail({
                entityType: 'approval_request',
                entityId: approvalRequest.id,
                documentNumber: approvalRequest.document_number,
                actionType: 'approve',
                afterData: { approval_level: nextLevel },
                reason: comments,
                severity: 'info'
            });

            // Notify next-level approver
            if (nextApprover?.email) {
                createNotification({
                    userEmail:             nextApprover.email,
                    notificationType:      'approval_pending',
                    priority:              'high',
                    title:                 'Approval Required',
                    message:               `${approvalRequest.document_type.replace(/_/g, ' ')} ${approvalRequest.document_number} requires your approval (Level ${nextLevel})`,
                    relatedEntity:         approvalRequest.document_type,
                    relatedDocumentNumber: approvalRequest.document_number,
                    actionUrl:             '/Approvals',
                }).catch(() => {});
            }

            return {
                status: 'pending',
                message: `Approved at level ${currentLevel}. Moved to level ${nextLevel}`,
                nextLevel: nextLevel
            };
        }
    } catch (error) {
        console.error('Error processing approval:', error);
        throw error;
    }
}

/**
 * Update document status based on approval result
 */
async function updateDocumentStatus(documentType, documentId, approvalStatus) {
    try {
        const entityMap = {
            'sales_order': 'SalesOrder',
            'purchase_order': 'PurchaseOrder',
            'journal_entry': 'JournalEntry',
            'leave_request': 'LeaveRequest',
            'purchase_requisition': 'PurchaseRequisition',
            'vendor_invoice': 'VendorInvoice',
            'payment': 'Payment',
            'timesheet': 'Timesheet',
            'expense': 'ProjectExpense'
        };

        const entityName = entityMap[documentType];
        if (!entityName) return;

        // Map approval status to document status
        let documentStatus = approvalStatus;
        if (approvalStatus === 'approved') {
            if (documentType === 'sales_order') documentStatus = 'confirmed';
            if (documentType === 'purchase_order') documentStatus = 'approved';
            if (documentType === 'journal_entry') documentStatus = 'posted';
            if (documentType === 'leave_request') documentStatus = 'approved';
        }

        await matrixSales.entities[entityName].update(documentId, {
            status: documentStatus
        });
    } catch (error) {
        console.error('Error updating document status:', error);
    }
}

/**
 * Check if document needs approval
 */
export async function needsApproval(documentType, amount, branch = null, department = null) {
    const matrices = await getApplicableApprovalMatrix(documentType, amount, branch, department);
    return matrices && matrices.length > 0;
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovalsForUser(userEmail, userRole) {
    try {
        // Get by email or by role
        const approvals = await matrixSales.entities.ApprovalRequest.filter({
            status: 'pending'
        });

        // Filter for approvals where user is current approver
        const userApprovals = approvals.filter(req => 
            req.current_approver_email === userEmail || 
            req.current_approver_role === userRole
        );

        return userApprovals;
    } catch (error) {
        console.error('Error getting pending approvals:', error);
        return [];
    }
}

/**
 * Get approval status for a document
 */
export async function getApprovalStatus(documentNumber) {
    try {
        const requests = await matrixSales.entities.ApprovalRequest.filter({
            document_number: documentNumber
        });

        if (requests && requests.length > 0) {
            return requests[0];
        }

        return null;
    } catch (error) {
        console.error('Error getting approval status:', error);
        return null;
    }
}
