import { matrixSales } from "@/api/matrixSalesClient";
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
        const movement = await matrixSales.entities.StockMovement.create({
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
 * Reverse a posted Goods Receipt (undo stock posting)
 */
export async function reverseGoodsReceipt(grn, user = null) {
    try {
        const movement = await matrixSales.entities.StockMovement.create({
            movement_number: `GRR-${grn.grn_number}`,
            movement_date: new Date().toISOString().split('T')[0],
            movement_type: 'goods_receipt_reversal',
            material_code: grn.material_code,
            material_name: grn.material_name,
            batch_number: grn.batch_number,
            quantity: parseFloat(grn.quantity_received) || 0,
            unit_of_measure: grn.unit_of_measure,
            from_warehouse: grn.receiving_location,
            reference_document: grn.grn_number,
            reason: `Reversal of GRN ${grn.grn_number}`,
            cost_per_unit: parseFloat(grn.unit_price) || 0,
            total_value: (parseFloat(grn.quantity_received) || 0) * (parseFloat(grn.unit_price) || 0),
            performed_by: user?.email || grn.received_by,
            status: 'posted'
        });

        await updateStockLevel({
            materialCode: grn.material_code,
            materialName: grn.material_name,
            warehouse: grn.receiving_location,
            bin: grn.storage_bin,
            batch: grn.batch_number,
            quantity: parseFloat(grn.quantity_received) || 0,
            unitOfMeasure: grn.unit_of_measure,
            unitCost: parseFloat(grn.unit_price) || 0,
            operation: 'decrease'
        });

        return movement;
    } catch (error) {
        console.error('Error reversing goods receipt:', error);
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
        const movement = await matrixSales.entities.StockMovement.create({
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
            const stockLevels = await matrixSales.entities.StockLevel.filter({
                material_code: line.product_code,
                status: 'available'
            });

            let remainingToReserve = line.quantity;

            for (const stock of stockLevels) {
                if (remainingToReserve <= 0) break;

                const availableQty = stock.available_quantity || 0;
                const reserveQty = Math.min(availableQty, remainingToReserve);

                if (reserveQty > 0) {
                    await matrixSales.entities.StockLevel.update(stock.id, {
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
export async function updateStockLevel({ 
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

        const existingStock = await matrixSales.entities.StockLevel.filter(filter);

        if (existingStock && existingStock.length > 0) {
            // Update existing
            const stock = existingStock[0];
            const qty = parseFloat(quantity) || 0;
            const currentQty = parseFloat(stock.quantity) || 0;
            const newQty = operation === 'increase'
                ? currentQty + qty
                : Math.max(0, currentQty - qty);
            const newAvailable = newQty - (parseFloat(stock.reserved_quantity) || 0);

            await matrixSales.entities.StockLevel.update(stock.id, {
                quantity: newQty,
                available_quantity: newAvailable,
                total_value: newQty * (parseFloat(stock.unit_cost) || parseFloat(unitCost) || 0),
                last_movement_date: new Date().toISOString().split('T')[0],
                aging_days: 0
            });
        } else if (operation === 'increase') {
            // Create new stock level (only on receipt)
            const qty = parseFloat(quantity) || 0;
            const cost = parseFloat(unitCost) || 0;
            await matrixSales.entities.StockLevel.create({
                material_code: materialCode,
                material_name: materialName,
                warehouse_code: warehouse,
                warehouse_name: warehouse,
                bin_code: bin,
                batch_number: batch,
                quantity: qty,
                reserved_quantity: 0,
                available_quantity: qty,
                unit_of_measure: unitOfMeasure,
                unit_cost: cost,
                total_value: qty * cost,
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

        const stockLevels = await matrixSales.entities.StockLevel.filter(filter);
        
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
 * Process Stock Transfer Order — issue from source warehouse.
 * Call when STO transitions to 'in_transit'.
 */
export async function processSTOIssue(sto, user = null) {
    try {
        const movement = await matrixSales.entities.StockMovement.create({
            movement_number: `STO-OUT-${sto.sto_number}`,
            movement_date: sto.shipment_date || new Date().toISOString().split('T')[0],
            movement_type: 'transfer',
            material_code: sto.material_code,
            material_name: sto.material_name,
            batch_number: sto.batch_number || null,
            quantity: parseFloat(sto.quantity_shipped) || parseFloat(sto.quantity_requested) || 0,
            unit_of_measure: sto.unit_of_measure,
            from_warehouse: sto.from_warehouse_code,
            to_warehouse: sto.to_warehouse_code,
            reference_document: sto.sto_number,
            reason: `Stock transfer out — STO ${sto.sto_number}`,
            performed_by: user?.email || null,
            status: 'posted',
        });

        await updateStockLevel({
            materialCode: sto.material_code,
            materialName: sto.material_name,
            warehouse: sto.from_warehouse_code,
            quantity: parseFloat(sto.quantity_shipped) || parseFloat(sto.quantity_requested) || 0,
            unitOfMeasure: sto.unit_of_measure,
            operation: 'decrease',
        });

        await logAuditTrail({
            entityType: 'stock_movement', entityId: movement.id,
            documentNumber: movement.movement_number, actionType: 'create',
            afterData: movement, user, severity: 'info',
            relatedDocumentType: 'stock_transfer', relatedDocumentId: sto.sto_number,
        });

        return movement;
    } catch (error) {
        console.error('Error processing STO issue:', error);
        throw error;
    }
}

/**
 * Process Stock Transfer Order — receive at destination warehouse.
 * Call when STO transitions to 'received'.
 */
export async function processSTOReceipt(sto, user = null) {
    try {
        const movement = await matrixSales.entities.StockMovement.create({
            movement_number: `STO-IN-${sto.sto_number}`,
            movement_date: sto.receipt_date || new Date().toISOString().split('T')[0],
            movement_type: 'transfer',
            material_code: sto.material_code,
            material_name: sto.material_name,
            batch_number: sto.batch_number || null,
            quantity: parseFloat(sto.quantity_received) || parseFloat(sto.quantity_requested) || 0,
            unit_of_measure: sto.unit_of_measure,
            from_warehouse: sto.from_warehouse_code,
            to_warehouse: sto.to_warehouse_code,
            reference_document: sto.sto_number,
            reason: `Stock transfer in — STO ${sto.sto_number}`,
            performed_by: user?.email || null,
            status: 'posted',
        });

        await updateStockLevel({
            materialCode: sto.material_code,
            materialName: sto.material_name,
            warehouse: sto.to_warehouse_code,
            quantity: parseFloat(sto.quantity_received) || parseFloat(sto.quantity_requested) || 0,
            unitOfMeasure: sto.unit_of_measure,
            operation: 'increase',
        });

        await logAuditTrail({
            entityType: 'stock_movement', entityId: movement.id,
            documentNumber: movement.movement_number, actionType: 'create',
            afterData: movement, user, severity: 'info',
            relatedDocumentType: 'stock_transfer', relatedDocumentId: sto.sto_number,
        });

        return movement;
    } catch (error) {
        console.error('Error processing STO receipt:', error);
        throw error;
    }
}

/**
 * Post a cycle-count inventory adjustment.
 * Call when a CycleCount transitions to 'adjusted' with a non-zero variance.
 */
export async function postCycleCountAdjustment(cycleCount, user = null) {
    const variance = parseFloat(cycleCount.variance_quantity) || 0;
    if (variance === 0) return null;

    try {
        const movement = await matrixSales.entities.StockMovement.create({
            movement_number: `ADJ-${cycleCount.count_number}`,
            movement_date: cycleCount.count_date || new Date().toISOString().split('T')[0],
            movement_type: 'adjustment',
            material_code: cycleCount.material_code,
            material_name: cycleCount.material_name,
            batch_number: cycleCount.batch_number || null,
            quantity: Math.abs(variance),
            unit_of_measure: cycleCount.unit_of_measure || null,
            from_warehouse: variance < 0 ? cycleCount.warehouse_code : null,
            to_warehouse:   variance > 0 ? cycleCount.warehouse_code : null,
            reference_document: cycleCount.count_number,
            reason: `Cycle count adjustment: system ${cycleCount.system_quantity} → counted ${cycleCount.counted_quantity}`,
            cost_per_unit: parseFloat(cycleCount.unit_cost) || 0,
            total_value: Math.abs(variance) * (parseFloat(cycleCount.unit_cost) || 0),
            performed_by: user?.email || cycleCount.counted_by || null,
            status: 'posted',
        });

        // Adjust StockLevel to match counted quantity
        await updateStockLevel({
            materialCode: cycleCount.material_code,
            materialName: cycleCount.material_name,
            warehouse: cycleCount.warehouse_code,
            bin: cycleCount.bin_code || null,
            batch: cycleCount.batch_number || null,
            quantity: Math.abs(variance),
            unitCost: parseFloat(cycleCount.unit_cost) || 0,
            operation: variance > 0 ? 'increase' : 'decrease',
        });

        await logAuditTrail({
            entityType: 'stock_movement', entityId: movement.id,
            documentNumber: movement.movement_number, actionType: 'create',
            afterData: movement, user, severity: Math.abs(cycleCount.variance_percent) > 10 ? 'warning' : 'info',
            relatedDocumentType: 'cycle_count', relatedDocumentId: cycleCount.count_number,
        });

        return movement;
    } catch (error) {
        console.error('Error posting cycle count adjustment:', error);
        throw error;
    }
}

/**
 * Post finished-goods receipt from a completed production order.
 * Call when ProductionOrder transitions to 'completed'.
 */
export async function processProductionReceipt(order, user = null) {
    const qty = parseFloat(order.quantity_produced) || 0;
    if (qty <= 0) return null;

    try {
        const movement = await matrixSales.entities.StockMovement.create({
            movement_number: `PROD-${order.order_number}`,
            movement_date: order.end_date || new Date().toISOString().split('T')[0],
            movement_type: 'production',
            material_code: order.product_code,
            material_name: order.product_name,
            quantity: qty,
            to_warehouse: order.output_warehouse || 'FG-WH',
            reference_document: order.order_number,
            reason: `Finished goods receipt from production order ${order.order_number}`,
            performed_by: user?.email || order.operator_name || null,
            status: 'posted',
        });

        await updateStockLevel({
            materialCode: order.product_code,
            materialName: order.product_name,
            warehouse: order.output_warehouse || 'FG-WH',
            quantity: qty,
            operation: 'increase',
        });

        await logAuditTrail({
            entityType: 'stock_movement', entityId: movement.id,
            documentNumber: movement.movement_number, actionType: 'create',
            afterData: movement, user, severity: 'info',
            relatedDocumentType: 'production_order', relatedDocumentId: order.order_number,
        });

        return movement;
    } catch (error) {
        console.error('Error processing production receipt:', error);
        throw error;
    }
}

/**
 * Get stock aging analysis
 */
export async function getStockAgingAnalysis() {
    try {
        const stockLevels = await matrixSales.entities.StockLevel.list();
        
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