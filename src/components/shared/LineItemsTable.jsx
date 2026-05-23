import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MaterialForm from "@/components/admin/MaterialForm";
import { usePermissions } from "@/components/utils/usePermissions";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";
import { getItemCode, itemToSelectOption, materialToSalesLinePatch, normalizeItemCode } from "@/lib/itemSelection";

export default function LineItemsTable({ 
    lineItems = [], 
    onLineItemsChange,
    availableItems = [], // Products/Materials to select from
    itemType = "product" // "product", "material", or "sales_item"
}) {
    const [editingLines, setEditingLines] = useState(lineItems);
    const [createdItems, setCreatedItems] = useState([]);
    const [createDialog, setCreateDialog] = useState({ open: false, lineIndex: null, search: "" });
    const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
    const { currentOrg } = useOrganization();
    const queryClient = useQueryClient();

    useEffect(() => {
        setEditingLines(lineItems);
    }, [lineItems]);

    const handleAddLine = () => {
        const newLine = {
            line_number: editingLines.length + 1,
            product_code: '',
            product_name: '',
            description: '',
            quantity: 0,
            unit_of_measure: 'piece',
            unit_price: 0,
            discount_percent: 0,
            discount_amount: 0,
            line_total: 0
        };
        const updated = [...editingLines, newLine];
        setEditingLines(updated);
        onLineItemsChange(updated);
    };

    const handleRemoveLine = (index) => {
        const updated = editingLines.filter((_, i) => i !== index);
        // Renumber lines
        const renumbered = updated.map((line, i) => ({
            ...line,
            line_number: i + 1
        }));
        setEditingLines(renumbered);
        onLineItemsChange(renumbered);
    };

    const handleLineChange = (index, field, value) => {
        const updated = [...editingLines];
        updated[index][field] = value;

        // Auto-calculate line totals
        if (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') {
            const qty = parseFloat(updated[index].quantity) || 0;
            const price = parseFloat(updated[index].unit_price) || 0;
            const discountPercent = parseFloat(updated[index].discount_percent) || 0;
            
            const subtotal = qty * price;
            const discountAmount = subtotal * (discountPercent / 100);
            const lineTotal = subtotal - discountAmount;

            updated[index].discount_amount = discountAmount;
            updated[index].line_total = lineTotal;
        }

        setEditingLines(updated);
        onLineItemsChange(updated);
    };

    const allAvailableItems = useMemo(() => {
        const map = new Map();
        [...availableItems, ...createdItems].forEach((item) => {
            const code = getItemCode(item);
            if (code) map.set(code, item);
        });
        return Array.from(map.values());
    }, [availableItems, createdItems]);

    const handleItemSelect = (index, itemCode, itemOverride = null) => {
        const selectedItem = itemOverride || allAvailableItems.find(item => {
            const code = itemType === "product" ? item.product_code : getItemCode(item);
            return code === itemCode;
        });

        if (selectedItem) {
            const updated = [...editingLines];
            if (itemType === "product") {
                updated[index].product_code = selectedItem.product_code;
                updated[index].product_name = selectedItem.product_name;
                updated[index].unit_price = selectedItem.unit_price || 0;
                updated[index].unit_of_measure = selectedItem.unit_of_measure || 'piece';
                updated[index].description = selectedItem.specifications || '';
            } else if (itemType === "sales_item") {
                updated[index] = {
                    ...updated[index],
                    ...materialToSalesLinePatch(selectedItem)
                };
            } else {
                updated[index].material_code = selectedItem.material_code;
                updated[index].material_name = selectedItem.material_name;
                updated[index].unit_price = selectedItem.unit_price || selectedItem.unit_cost || 0;
                updated[index].unit_of_measure = selectedItem.unit_of_measure || 'kg';
                updated[index].description = selectedItem.material_type || '';
            }
            
            // Recalculate line total
            const qty = parseFloat(updated[index].quantity) || 0;
            const price = parseFloat(updated[index].unit_price) || 0;
            const discountPercent = parseFloat(updated[index].discount_percent) || 0;
            const subtotal = qty * price;
            const discountAmount = subtotal * (discountPercent / 100);
            updated[index].line_total = subtotal - discountAmount;
            updated[index].discount_amount = discountAmount;

            setEditingLines(updated);
            onLineItemsChange(updated);
        }
    };

    // Prepare options for SearchableSelect
    const itemOptions = allAvailableItems.map(item => (
        itemType === "product"
            ? {
                value: item.product_code,
                label: `${item.product_code} - ${item.product_name}`
            }
            : itemToSelectOption(item)
    ));

    const canCreateItems = permissionsLoading || isAdmin || hasPermission('master_data.material', 'create');
    const selectorLabel = itemType === "material" ? "material" : "item";

    const openCreateItem = (lineIndex, search = "") => {
        setCreateDialog({ open: true, lineIndex, search });
    };

    const closeCreateItem = () => {
        setCreateDialog({ open: false, lineIndex: null, search: "" });
    };

    const getInitialMaterialValues = () => {
        const search = createDialog.search?.trim() || "";
        const looksLikeCode = /^[a-z0-9-_]+$/i.test(search) && !search.includes(" ");
        return {
            material_code: looksLikeCode ? normalizeItemCode(search) : "",
            material_name: looksLikeCode ? "" : search,
            material_type: "finished_product",
            unit_of_measure: "piece",
            organization_id: currentOrg?.id,
            tenant_id: currentOrg?.id,
            status: "active",
            inventory_tracking_enabled: true,
            vat_rate: 15
        };
    };

    const handleCreatedItem = (item) => {
        if (!item) return;
        setCreatedItems(prev => [item, ...prev.filter(existing => getItemCode(existing) !== getItemCode(item))]);
        queryClient.setQueryData(['materials'], (old = []) => {
            const list = Array.isArray(old) ? old : [];
            return [item, ...list.filter(existing => getItemCode(existing) !== getItemCode(item))];
        });
        if (currentOrg?.id) {
            queryClient.setQueryData(['materials', currentOrg.id], (old = []) => {
                const list = Array.isArray(old) ? old : [];
                return [item, ...list.filter(existing => getItemCode(existing) !== getItemCode(item))];
            });
        }
        queryClient.invalidateQueries({ queryKey: ['materials'] });

        if (createDialog.lineIndex !== null) {
            handleItemSelect(createDialog.lineIndex, getItemCode(item), item);
        } else {
            const newLine = {
                line_number: editingLines.length + 1,
                product_code: '',
                product_name: '',
                description: '',
                quantity: 1,
                unit_of_measure: 'piece',
                unit_price: 0,
                discount_percent: 0,
                discount_amount: 0,
                line_total: 0,
                ...materialToSalesLinePatch(item)
            };
            const subtotal = (parseFloat(newLine.quantity) || 0) * (parseFloat(newLine.unit_price) || 0);
            newLine.line_total = subtotal;
            const updated = [...editingLines, newLine];
            setEditingLines(updated);
            onLineItemsChange(updated);
        }
    };

    // Calculate totals
    const totalQuantity = editingLines.reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0);
    const totalAmount = editingLines.reduce((sum, line) => sum + (parseFloat(line.line_total) || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Line Items</h3>
                <div className="flex items-center gap-2">
                    {canCreateItems && (
                        <Button type="button" onClick={() => openCreateItem(null, "")} variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Item
                        </Button>
                    )}
                    <Button type="button" onClick={handleAddLine} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Line
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg">
                {/* Fixed Table Header */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-gray-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead className="min-w-[250px]">{itemType === "material" ? "Material" : "Item"}</TableHead>
                                <TableHead className="min-w-[200px]">Description</TableHead>
                                <TableHead className="w-28">Quantity</TableHead>
                                <TableHead className="w-28">Unit Price</TableHead>
                                <TableHead className="w-28">Discount %</TableHead>
                                <TableHead className="w-32">Line Total</TableHead>
                                <TableHead className="w-16">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                    </Table>
                </div>

                {/* Scrollable Table Body - Fixed height for 10 rows */}
                <div className="overflow-auto" style={{ maxHeight: "480px" }}>
                    <Table>
                        <TableBody>
                            {editingLines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        No line items. Click "Add Line" to begin.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                editingLines.map((line, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="w-12">{line.line_number}</TableCell>
                                        <TableCell className="min-w-[250px]">
                                            <SearchableSelect
                                                value={itemType === "product" ? line.product_code : (line.material_code || line.product_code)}
                                                onValueChange={(value) => handleItemSelect(index, value)}
                                                options={itemOptions}
                                                placeholder={`Select ${selectorLabel}...`}
                                                searchPlaceholder={`Search ${selectorLabel}s...`}
                                                emptyMessage={canCreateItems ? "No items found. Create an item." : "No items found."}
                                                noResultsMessage={canCreateItems ? "No matching item found. Create new item." : "No matching item found."}
                                                createOptionLabel="Create Item"
                                                showCreateOption={canCreateItems}
                                                onCreateOption={(search) => openCreateItem(index, search)}
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[200px]">
                                            <Input
                                                value={line.description || ''}
                                                onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                                                placeholder="Description"
                                            />
                                        </TableCell>
                                        <TableCell className="w-28">
                                            <Input
                                                type="number"
                                                value={line.quantity}
                                                onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </TableCell>
                                        <TableCell className="w-28">
                                            <Input
                                                type="number"
                                                value={line.unit_price}
                                                onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </TableCell>
                                        <TableCell className="w-28">
                                            <Input
                                                type="number"
                                                value={line.discount_percent}
                                                onChange={(e) => handleLineChange(index, 'discount_percent', e.target.value)}
                                                min="0"
                                                max="100"
                                                step="0.01"
                                            />
                                        </TableCell>
                                        <TableCell className="w-32">
                                            <div className="font-semibold">
                                                SAR {(line.line_total || 0).toFixed(2)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-16">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveLine(index)}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Summary Footer */}
                {editingLines.length > 0 && (
                    <div className="bg-gray-50 p-4 border-t">
                        <div className="flex justify-end gap-8">
                            <div className="text-right">
                                <div className="text-sm text-gray-600">Total Items</div>
                                <div className="text-lg font-semibold">{editingLines.length}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-600">Total Quantity</div>
                                <div className="text-lg font-semibold">{totalQuantity.toFixed(2)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-600">Total Amount</div>
                                <div className="text-xl font-bold text-emerald-600">SAR {totalAmount.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {editingLines.length === 0 && (
                <div className="text-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
                    <Search className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                    <p className="text-blue-900 font-semibold">No line items added yet</p>
                    <p className="text-blue-700 text-sm mt-1">Click "Add Line" button to add items to this document</p>
                </div>
            )}

            <Dialog open={createDialog.open} onOpenChange={(open) => !open && closeCreateItem()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Item</DialogTitle>
                    </DialogHeader>
                    <MaterialForm
                        initialValues={getInitialMaterialValues()}
                        onClose={closeCreateItem}
                        onSaved={handleCreatedItem}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
