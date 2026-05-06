import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

/**
 * This component handles real-time stock synchronization when:
 * - Purchase orders are received (GRN)
 * - Sales orders are delivered
 * - Production orders consume/produce materials
 */
export default function RealTimeStockSync() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    useEffect(() => {
        // Poll for recent changes every 30 seconds
        const interval = setInterval(() => {
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
        }, 30000);

        return () => clearInterval(interval);
    }, [queryClient]);

    return null; // This is a background service component
}

/**
 * Utility function to update stock levels when a GRN is posted
 */
export async function syncStockFromGRN(grn) {
    if (grn.status !== 'posted') return;

    const existingStock = await base44.entities.StockLevel.filter({
        material_code: grn.material_code,
        warehouse_code: grn.delivery_location_code,
        batch_number: grn.batch_number
    });

    if (existingStock && existingStock.length > 0) {
        // Update existing stock
        const stock = existingStock[0];
        await base44.entities.StockLevel.update(stock.id, {
            quantity: (stock.quantity || 0) + grn.quantity_received,
            available_quantity: (stock.available_quantity || 0) + grn.quantity_received,
            total_value: (stock.total_value || 0) + (grn.quantity_received * (grn.unit_price || 0)),
            last_movement_date: new Date().toISOString().split('T')[0],
            aging_days: 0
        });
    } else {
        // Create new stock level entry
        await base44.entities.StockLevel.create({
            material_code: grn.material_code,
            material_name: grn.material_name,
            warehouse_code: grn.delivery_location_code,
            warehouse_name: grn.delivery_location_code,
            batch_number: grn.batch_number,
            quantity: grn.quantity_received,
            reserved_quantity: 0,
            available_quantity: grn.quantity_received,
            unit_of_measure: grn.unit_of_measure,
            unit_cost: grn.unit_price,
            total_value: grn.quantity_received * (grn.unit_price || 0),
            last_movement_date: new Date().toISOString().split('T')[0],
            aging_days: 0,
            status: 'available'
        });
    }

    // Create stock movement record
    await base44.entities.StockMovement.create({
        movement_number: `GR-${grn.grn_number}`,
        movement_date: new Date().toISOString().split('T')[0],
        movement_type: 'goods_receipt',
        material_code: grn.material_code,
        material_name: grn.material_name,
        batch_number: grn.batch_number,
        quantity: grn.quantity_received,
        unit_of_measure: grn.unit_of_measure,
        to_warehouse: grn.delivery_location_code,
        reference_document: grn.grn_number,
        reason: `GRN from PO ${grn.po_number}`,
        cost_per_unit: grn.unit_price,
        total_value: grn.quantity_received * (grn.unit_price || 0),
        performed_by: grn.received_by,
        status: 'posted'
    });
}

/**
 * Utility function to update stock levels when a delivery is posted
 */
export async function syncStockFromDelivery(delivery) {
    if (!delivery.pgi_done) return;

    const existingStock = await base44.entities.StockLevel.filter({
        material_code: delivery.product_code,
        warehouse_code: delivery.warehouse_code || 'MAIN'
    });

    if (existingStock && existingStock.length > 0) {
        const stock = existingStock[0];
        await base44.entities.StockLevel.update(stock.id, {
            quantity: (stock.quantity || 0) - delivery.quantity_delivered,
            available_quantity: (stock.available_quantity || 0) - delivery.quantity_delivered,
            total_value: (stock.total_value || 0) - (delivery.quantity_delivered * (stock.unit_cost || 0))
        });
    }

    // Create stock movement record
    await base44.entities.StockMovement.create({
        movement_number: `GI-${delivery.delivery_number}`,
        movement_date: delivery.delivery_date,
        movement_type: 'goods_issue',
        material_code: delivery.product_code,
        material_name: delivery.product_name,
        quantity: delivery.quantity_delivered,
        from_warehouse: delivery.warehouse_code || 'MAIN',
        reference_document: delivery.sales_order_number,
        reason: `Delivery to ${delivery.customer_name}`,
        cost_per_unit: existingStock[0]?.unit_cost || 0,
        total_value: delivery.quantity_delivered * (existingStock[0]?.unit_cost || 0),
        performed_by: delivery.pgi_by,
        status: 'posted'
    });
}

/**
 * Utility function to reserve stock for sales orders
 */
export async function reserveStockForSalesOrder(salesOrder) {
    if (salesOrder.status !== 'approved' && salesOrder.status !== 'confirmed') return;

    const existingStock = await base44.entities.StockLevel.filter({
        material_code: salesOrder.product_code,
        status: 'available'
    });

    if (existingStock && existingStock.length > 0) {
        const stock = existingStock[0];
        const availableQty = stock.available_quantity || 0;
        const quantityToReserve = Math.min(availableQty, salesOrder.quantity);

        if (quantityToReserve > 0) {
            await base44.entities.StockLevel.update(stock.id, {
                reserved_quantity: (stock.reserved_quantity || 0) + quantityToReserve,
                available_quantity: availableQty - quantityToReserve
            });
        }
    }
}