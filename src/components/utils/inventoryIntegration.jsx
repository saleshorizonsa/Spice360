import { base44 } from "@/api/base44Client";
import { logAuditTrail } from "./auditTrail";

/**
 * Inventory Integration Utilities
 * Handles automatic stock updates from Purchase Orders and Sales Orders
 */

/**
 * Process Goods Receipt from Purchase Order (GRN)
 * Creates stock movement and updates stock levels
 */
export async function processGoodsReceipt(grn, user = null) {
    try {
        // Create stock movement
        const movement = await base44.entities.StockMovement.create({
            movement_number: `GR-${grn.grn_number}`,
            movement_date: grn.receipt_date,
            movement_type: 'goods_receipt',
            material_code: grn.material_code,
            material_name: grn.material_name,
            batch_number: grn.batch_number,
            quantity: grn.quantity_received,
            unit_of_measure: grn.unit_of_measure,
            to_warehouse: grn.receiving_location,
            to_bin: grn.storage_bin,
            reference_document: grn.po_number,
            reason: `Goods receipt from PO ${grn.po_number}`,
            cost_per_unit: grn.unit_price,
            total_value: grn.quantity_received * grn.unit_price,
            performed_by: user?.email || grn.received_by,
            status: 'posted'
        });

        // Update stock level
        await updateStockLevel({
            materialCode: grn.material_code,
            materialName: grn.material_name,
            warehouse: grn.receiving_location,
            bin: grn.storage_bin,
            batch: grn.batch_number,
            quantity: grn.quantity_received,
            unitOfMeasure: grn.unit_of_measure,
            unitCost: grn.unit_price,
            operation: 'increase'
        });

        // Log audit trail
        await logAuditTrail({
            entityType: 'stock_movement',
            entityId: movement.id,
            documentNumber: movement.movement_number,
            actionType: 'create',
            afterData: movement,
            user: user,
            severity: 'info',
            relatedDocumentType: 'purchase_order',
            relatedDocumentId: grn.po_number
        });

        return movement;
    } catch (error) {
        console.error('Error processing goods receipt:', error);
        throw error;
    }
}

/**
 * Process Goods Issue for Sales Order (PGI - Post Goods Issue)
 * Creates stock movement and updates stock levels
 */
export async function processGoodsIssue(delivery, user = null) {
    try {
        // Create stock movement
        const movement = await base44.entities.StockMovement.create({
            movement_number: `GI-${delivery.delivery_number}`,
            movement_date: delivery.delivery_date,
            movement_type: 'goods_issue',
            material_code: delivery.product_code,
            material_name: delivery.product_name,
            batch_number: delivery.batch_number,
            quantity: delivery.quantity_delivered,
            unit_of_measure: delivery.unit_of_measure,
            from_warehouse: delivery.shipping_location,
            from_bin: delivery.picking_bin,
            reference_document: delivery.sales_order_number,
            reason: `Goods issue for SO ${delivery.sales_order_number}`,
            cost_per_unit: 0, // Use average cost from stock level
            total_value: 0,
            performed_by: user?.email || delivery.created_by,
            status: 'posted'
        });

        // Update stock level
        await updateStockLevel({
            materialCode: delivery.product_code,
            materialName: delivery.product_name,
            warehouse: delivery.shipping_location,
            bin: delivery.picking_bin,
            batch: delivery.batch_number,
            quantity: delivery.quantity_delivered,
            unitOfMeasure: delivery.unit_of_measure,
            operation: 'decrease'
        });

        // Log audit trail
        await logAuditTrail({
            entityType: 'stock_movement',
            entityId: movement.id,
            documentNumber: movement.movement_number,
            actionType: 'create',
            afterData: movement,
            user: user,
            severity: 'info',
            relatedDocumentType: 'sales_order',
            relatedDocumentId: delivery.sales_order_number
        });

        return movement;
    } catch (error) {
        console.error('Error processing goods issue:', error);
        throw error;
    }
}

/**
 * Reserve stock for Sales Order
 */
export async function reserveStock(salesOrder, lineItems, user = null) {
    try {
        for (const line of lineItems) {
            // Find available stock
            const stockLevels = await base44.entities.StockLevel.filter({
                material_code: line.product_code,
                status: 'available'
            });

            let remainingToReserve = line.quantity;

            for (const stock of stockLevels) {
                if (remainingToReserve <= 0) break;

                const availableQty = stock.available_quantity || 0;
                const reserveQty = Math.min(availableQty, remainingToReserve);

                if (reserveQty > 0) {
                    await base44.entities.StockLevel.update(stock.id, {
                        reserved_quantity: (stock.reserved_quantity || 0) + reserveQty,
                        available_quantity: availableQty - reserveQty
                    });

                    remainingToReserve -= reserveQty;
                }
            }

            if (remainingToReserve > 0) {
                console.warn(`Insufficient stock for ${line.product_code}. Short by ${remainingToReserve}`);
            }
        }

        // Log audit trail
        await logAuditTrail({
            entityType: 'stock_level',
            entityId: salesOrder.id,
            documentNumber: salesOrder.order_number,
            actionType: 'update',
            afterData: { action: 'stock_reserved' },
            user: user,
            severity: 'info',
            relatedDocumentType: 'sales_order',
            relatedDocumentId: salesOrder.id
        });
    } catch (error) {
        console.error('Error reserving stock:', error);
        throw error;
    }
}

/**
 * Update stock level (core function)
 */
async function updateStockLevel({ 
    materialCode, 
    materialName, 
    warehouse, 
    bin, 
    batch, 
    quantity, 
    unitOfMeasure,
    unitCost = 0,
    operation 
}) {
    try {
        // Find existing stock level
        const filter = {
            material_code: materialCode,
            warehouse_code: warehouse
        };
        if (bin) filter.bin_code = bin;
        if (batch) filter.batch_number = batch;

        const existingStock = await base44.entities.StockLevel.filter(filter);

        if (existingStock && existingStock.length > 0) {
            // Update existing
            const stock = existingStock[0];
            const newQty = operation === 'increase' 
                ? (stock.quantity || 0) + quantity 
                : Math.max(0, (stock.quantity || 0) - quantity);
            const newAvailable = newQty - (stock.reserved_quantity || 0);

            await base44.entities.StockLevel.update(stock.id, {
                quantity: newQty,
                available_quantity: newAvailable,
                total_value: newQty * (stock.unit_cost || unitCost),
                last_movement_date: new Date().toISOString().split('T')[0],
                aging_days: 0 // Reset aging on new movement
            });
        } else if (operation === 'increase') {
            // Create new stock level (only on receipt)
            await base44.entities.StockLevel.create({
                material_code: materialCode,
                material_name: materialName,
                warehouse_code: warehouse,
                warehouse_name: warehouse, // You might want to look this up
                bin_code: bin,
                batch_number: batch,
                quantity: quantity,
                reserved_quantity: 0,
                available_quantity: quantity,
                unit_of_measure: unitOfMeasure,
                unit_cost: unitCost,
                total_value: quantity * unitCost,
                last_movement_date: new Date().toISOString().split('T')[0],
                aging_days: 0,
                status: 'available'
            });
        }
    } catch (error) {
        console.error('Error updating stock level:', error);
        throw error;
    }
}

/**
 * Check stock availability for Sales Order
 */
export async function checkStockAvailability(materialCode, requiredQuantity, warehouse = null) {
    try {
        const filter = { 
            material_code: materialCode,
            status: 'available'
        };
        if (warehouse) filter.warehouse_code = warehouse;

        const stockLevels = await base44.entities.StockLevel.filter(filter);
        
        const totalAvailable = stockLevels.reduce((sum, s) => sum + (s.available_quantity || 0), 0);
        
        return {
            available: totalAvailable >= requiredQuantity,
            totalAvailable: totalAvailable,
            shortage: Math.max(0, requiredQuantity - totalAvailable),
            stockByLocation: stockLevels.map(s => ({
                warehouse: s.warehouse_name,
                bin: s.bin_code,
                available: s.available_quantity
            }))
        };
    } catch (error) {
        console.error('Error checking stock availability:', error);
        return {
            available: false,
            totalAvailable: 0,
            shortage: requiredQuantity,
            stockByLocation: []
        };
    }
}

/**
 * Get stock aging analysis
 */
export async function getStockAgingAnalysis() {
    try {
        const stockLevels = await base44.entities.StockLevel.list();
        
        const analysis = {
            fast_moving: stockLevels.filter(s => s.aging_days <= 30).length,
            slow_moving: stockLevels.filter(s => s.aging_days > 90).length,
            obsolete: stockLevels.filter(s => s.aging_days > 180 || s.status === 'obsolete').length,
            totalValue: stockLevels.reduce((sum, s) => sum + (s.total_value || 0), 0)
        };

        return analysis;
    } catch (error) {
        console.error('Error getting stock aging:', error);
        return null;
    }
}