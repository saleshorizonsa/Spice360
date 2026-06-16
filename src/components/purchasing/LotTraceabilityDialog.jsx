import React, { useState } from "react";
import { matrixSales } from "@/api/matrixSalesClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Truck, FileText, FlaskConical, X } from "lucide-react";

const QUALITY_COLORS = {
    passed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    quarantine: "bg-orange-100 text-orange-800"
};

export default function LotTraceabilityDialog({ onClose }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [grns, setGrns] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setIsSearching(true);
        setHasSearched(true);
        try {
            const [grnResults, deliveryResults] = await Promise.all([
                matrixSales.entities.GoodsReceiptNote.filter({ batch_number: searchTerm.trim() }),
                matrixSales.entities.Delivery.filter({ batch_number: searchTerm.trim() }).catch(() => [])
            ]);
            setGrns(Array.isArray(grnResults) ? grnResults : []);
            setDeliveries(Array.isArray(deliveryResults) ? deliveryResults : []);
        } catch (err) {
            console.error("Lot search error:", err);
            setGrns([]);
            setDeliveries([]);
        } finally {
            setIsSearching(false);
        }
    };

    const totalReceived = grns.reduce((s, g) => s + (parseFloat(g.quantity_received) || 0), 0);
    const totalDelivered = deliveries.reduce((s, d) => s + (parseFloat(d.quantity_delivered) || 0), 0);
    const balanceOnHand = totalReceived - totalDelivered;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FlaskConical className="w-5 h-5 text-teal-600" />
                        Lot / Batch Traceability
                    </DialogTitle>
                </DialogHeader>

                {/* Search */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Label>Batch / Lot Number</Label>
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="Enter batch or lot number..."
                            className="mt-1"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={handleSearch}
                            disabled={isSearching || !searchTerm.trim()}
                            className="bg-teal-600 hover:bg-teal-700"
                        >
                            <Search className="w-4 h-4 mr-2" />
                            {isSearching ? "Searching..." : "Search"}
                        </Button>
                    </div>
                </div>

                {/* Summary row */}
                {hasSearched && (grns.length > 0 || deliveries.length > 0) && (
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                            { label: "Total Received", value: totalReceived, color: "bg-blue-50 border-blue-200 text-blue-800" },
                            { label: "Total Dispatched", value: totalDelivered, color: "bg-amber-50 border-amber-200 text-amber-800" },
                            { label: "Balance on Hand", value: balanceOnHand, color: balanceOnHand >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800" },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`border rounded-lg p-3 ${color}`}>
                                <p className="text-xs font-medium">{label}</p>
                                <p className="text-xl font-bold">{value.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* GRN Results */}
                {hasSearched && (
                    <div className="space-y-4 mt-2">
                        <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                                <Package className="w-4 h-4 text-emerald-600" />
                                Receipts (GRN) — {grns.length} record{grns.length !== 1 ? "s" : ""}
                            </h3>
                            {grns.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No goods receipts found for this lot.</p>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">GRN #</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Vendor</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-600">Qty Received</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Location</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Quality</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Mfg Date</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Expiry</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Phyto Cert</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Origin</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {grns.map(g => (
                                                <tr key={g.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-mono text-teal-700 font-semibold">{g.grn_number}</td>
                                                    <td className="px-3 py-2">{g.grn_date}</td>
                                                    <td className="px-3 py-2">
                                                        <p className="font-medium">{g.material_name}</p>
                                                        <p className="text-gray-400">{g.material_code}</p>
                                                    </td>
                                                    <td className="px-3 py-2">{g.vendor_name}</td>
                                                    <td className="px-3 py-2 text-right font-semibold">
                                                        {(parseFloat(g.quantity_received) || 0).toLocaleString()} {g.unit_of_measure}
                                                    </td>
                                                    <td className="px-3 py-2">{g.receiving_location || "—"}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${QUALITY_COLORS[g.quality_status] || "bg-gray-100 text-gray-800"}`}>
                                                            {g.quality_status || "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">{g.lot_manufactured_date || "—"}</td>
                                                    <td className="px-3 py-2">
                                                        {g.expiry_date ? (
                                                            <span className={g.expiry_date < new Date().toISOString().slice(0, 10) ? "text-red-600 font-semibold" : ""}>
                                                                {g.expiry_date}
                                                            </span>
                                                        ) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 font-mono text-xs">{g.phyto_cert_no || "—"}</td>
                                                    <td className="px-3 py-2">{g.origin_country || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Delivery Results */}
                        <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                                <Truck className="w-4 h-4 text-blue-600" />
                                Dispatches (Delivery Notes) — {deliveries.length} record{deliveries.length !== 1 ? "s" : ""}
                            </h3>
                            {deliveries.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No dispatches found for this lot.</p>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Delivery #</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Customer</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">SO #</th>
                                                <th className="px-3 py-2 text-right font-medium text-gray-600">Qty Dispatched</th>
                                                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {deliveries.map(d => (
                                                <tr key={d.id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-mono text-blue-700 font-semibold">{d.delivery_number}</td>
                                                    <td className="px-3 py-2">{d.delivery_date}</td>
                                                    <td className="px-3 py-2">{d.customer_name}</td>
                                                    <td className="px-3 py-2 font-mono text-xs">{d.sales_order_number}</td>
                                                    <td className="px-3 py-2 text-right font-semibold">
                                                        {(parseFloat(d.quantity_delivered) || 0).toLocaleString()} {d.unit_of_measure}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                            {d.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {hasSearched && grns.length === 0 && deliveries.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p>No records found for lot <strong>"{searchTerm}"</strong></p>
                                <p className="text-xs mt-1">Check the batch number and try again.</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-2 border-t">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
