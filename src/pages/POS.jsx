import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { matrixSales } from "@/api/matrixSalesClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ShoppingCart, Search, Plus, Minus, CreditCard,
    Receipt, RotateCcw, BarChart3, TrendingUp,
    Package, Printer, X, CheckCircle2, Scan,
    Zap, FileText, Boxes, ChevronRight, Tag
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import DataTable from "@/components/erp/DataTable";
import { useTaxConfig } from "@/hooks/useTaxConfig";
import { useGLAccounts } from "@/hooks/useGLAccounts";
import { useOrganization } from "@/components/utils/OrganizationContext";
import { postJournalEntry } from "@/components/utils/journalService";

// Category color map for touch tiles
const CATEGORY_COLORS = {
    pipes: "from-blue-500 to-blue-600",
    fittings: "from-cyan-500 to-cyan-600",
    sheets: "from-teal-500 to-teal-600",
    profiles: "from-indigo-500 to-indigo-600",
    compounds: "from-violet-500 to-violet-600",
    raw_materials: "from-orange-500 to-orange-600",
    finished_goods: "from-emerald-500 to-emerald-600",
    semi_finished: "from-lime-500 to-lime-600",
    consumables: "from-amber-500 to-amber-600",
    spare_parts: "from-red-400 to-red-500",
    finished_product: "from-emerald-500 to-emerald-600",
    other: "from-gray-400 to-gray-500",
};

function getCategoryColor(cat) {
    return CATEGORY_COLORS[cat] || "from-gray-400 to-gray-500";
}

export default function POS() {
    const [activeTab, setActiveTab] = useState("register");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [cart, setCart] = useState([]);
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [cashReceived, setCashReceived] = useState("");
    const [discountPercent, setDiscountPercent] = useState(0);
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);
    const [barcodeBuffer, setBarcodeBuffer] = useState("");
    const [barcodeActive, setBarcodeActive] = useState(false);
    const barcodeTimeout = useRef(null);
    const searchRef = useRef(null);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const taxConfig = useTaxConfig();
    const vatRate = taxConfig.vat_standard_rate / 100;
    const gl = useGLAccounts();
    const { currentOrg } = useOrganization();

    const { data: products = [] } = useQuery({
        queryKey: ['posProducts'],
        queryFn: () => matrixSales.entities.Product.filter({ status: 'active' }),
        initialData: []
    });

    const { data: materials = [] } = useQuery({
        queryKey: ['posMaterials'],
        queryFn: () => matrixSales.entities.Material.filter({ status: 'active' }),
        initialData: []
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['posTransactions'],
        queryFn: () => matrixSales.entities.POSTransaction.list('-transaction_date', 100),
        initialData: []
    });

    // Combine products + finished materials
    const allItems = [
        ...products.map(p => ({
            id: p.id, code: p.product_code, name: p.product_name,
            price: p.unit_price || 0, category: p.category || 'other',
            stock: p.current_stock, source: 'product'
        })),
        ...materials.filter(m => m.material_type === 'finished_product').map(m => ({
            id: m.id, code: m.material_code, name: m.material_name,
            price: m.unit_price || 0, category: m.material_type || 'other',
            stock: m.current_stock, source: 'material'
        }))
    ];

    const categories = ["all", ...Array.from(new Set(allItems.map(i => i.category)))];

    const filteredItems = allItems.filter(item => {
        const matchSearch = !searchTerm ||
            item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCat = activeCategory === "all" || item.category === activeCategory;
        return matchSearch && matchCat;
    });

    // ── Barcode scanner support ──
    // Hardware scanners type rapidly and end with Enter. We capture global keydown.
    useEffect(() => {
        const handleKeyDown = (e) => {
            // If focus is on an input other than the barcode/search field, skip
            if (document.activeElement?.tagName === 'INPUT' &&
                document.activeElement !== searchRef.current) return;

            if (e.key === 'Enter') {
                if (barcodeBuffer.trim().length > 0) {
                    const match = allItems.find(
                        i => i.code?.toLowerCase() === barcodeBuffer.trim().toLowerCase()
                    );
                    if (match) {
                        addToCart(match);
                        toast({ title: `✓ ${match.name}`, description: `Added to cart via barcode` });
                    } else {
                        toast({ title: "Barcode not found", description: barcodeBuffer, variant: "destructive" });
                    }
                    setBarcodeBuffer("");
                    setSearchTerm("");
                }
                return;
            }

            if (e.key.length === 1) {
                clearTimeout(barcodeTimeout.current);
                setBarcodeBuffer(prev => prev + e.key);
                // Reset buffer if no more keystrokes within 100ms (end of scan)
                barcodeTimeout.current = setTimeout(() => setBarcodeBuffer(""), 500);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearTimeout(barcodeTimeout.current);
        };
    }, [barcodeBuffer, allItems]);

    // Cart calculations
    const cartSubtotal = cart.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = (cartSubtotal * discountPercent) / 100;
    const taxableAmount = cartSubtotal - discountAmount;
    const vatAmount = taxableAmount * vatRate;
    const totalAmount = taxableAmount + vatAmount;
    const changeGiven = paymentMethod === 'cash' ? Math.max(0, parseFloat(cashReceived || 0) - totalAmount) : 0;

    const addToCart = useCallback((item) => {
        setCart(prev => {
            const existing = prev.find(c => c.product_code === item.code);
            if (existing) {
                return prev.map(c => c.product_code === item.code
                    ? { ...c, quantity: c.quantity + 1, line_total: (c.quantity + 1) * c.unit_price }
                    : c
                );
            }
            return [...prev, {
                product_code: item.code,
                product_name: item.name,
                quantity: 1,
                unit_price: item.price,
                discount_percent: 0,
                line_total: item.price,
                vat_amount: item.price * vatRate
            }];
        });
    }, [vatRate]);

    const updateQty = (code, delta) => {
        setCart(prev => prev
            .map(c => c.product_code === code
                ? { ...c, quantity: Math.max(0, c.quantity + delta), line_total: Math.max(0, c.quantity + delta) * c.unit_price }
                : c
            )
            .filter(c => c.quantity > 0)
        );
    };

    const removeFromCart = (code) => setCart(prev => prev.filter(c => c.product_code !== code));

    const generateTxNumber = () => {
        const now = new Date();
        return `POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-5)}`;
    };

    const createTransactionMutation = useMutation({
        mutationFn: async (data) => {
            const tx = await matrixSales.entities.POSTransaction.create(data);

            // ── GL posting (non-fatal) ────────────────────────────────
            try {
                const lines = [];
                // Debit Cash/Bank for total received
                lines.push({ account_code: gl.cash_bank,     account_name: "Cash / Bank",   debit: data.total_amount,                           credit: 0,                                          description: `POS ${data.transaction_number}` });
                // Credit Sales Revenue (net of VAT)
                lines.push({ account_code: gl.sales_revenue, account_name: "Sales Revenue", debit: 0,                                           credit: data.subtotal - (data.discount_amount || 0), description: `POS ${data.transaction_number}` });
                // Credit VAT Output
                if ((data.vat_amount || 0) > 0) {
                    lines.push({ account_code: gl.vat_output, account_name: "VAT Output",   debit: 0,                                           credit: data.vat_amount, description: `POS VAT ${data.transaction_number}` });
                }
                await postJournalEntry({
                    description: `POS Sale — ${data.transaction_number}`,
                    entryDate: data.transaction_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                    referenceType: "pos_transaction",
                    referenceId: tx.id,
                    entryType: "sales",
                    lines,
                    orgId: currentOrg?.id,
                    area: "ar",
                });
            } catch (_) { /* non-fatal */ }

            // ── Inventory reduction (non-fatal) ───────────────────────
            try {
                for (const cartLine of data.items || []) {
                    const levels = await matrixSales.entities.StockLevel.filter({ material_code: cartLine.product_code });
                    const available = (levels || []).filter(l => (l.available_quantity || 0) > 0);
                    let remaining = parseFloat(cartLine.quantity) || 0;
                    for (const lvl of available) {
                        if (remaining <= 0) break;
                        const deduct = Math.min(remaining, parseFloat(lvl.available_quantity) || 0);
                        const prevQty = parseFloat(lvl.quantity) || 0;
                        const newQty = Math.max(0, prevQty - deduct);
                        const unitCost = prevQty > 0 ? (parseFloat(lvl.total_value) || 0) / prevQty : 0;
                        await matrixSales.entities.StockLevel.update(lvl.id, {
                            quantity: newQty,
                            available_quantity: Math.max(0, newQty - (parseFloat(lvl.reserved_quantity) || 0)),
                            total_value: Math.max(0, newQty * unitCost),
                            last_movement_date: new Date().toISOString().slice(0, 10),
                        });
                        await matrixSales.entities.StockMovement.create({
                            movement_number: `POS-${data.transaction_number}-${cartLine.product_code}`,
                            movement_date: new Date().toISOString().slice(0, 10),
                            movement_type: 'sales_issue',
                            material_code: cartLine.product_code,
                            material_name: cartLine.product_name,
                            quantity: deduct,
                            from_warehouse: lvl.warehouse_code,
                            reference_document: data.transaction_number,
                            reason: `POS sale — ${data.transaction_number}`,
                            cost_per_unit: unitCost,
                            total_value: deduct * unitCost,
                            performed_by: data.cashier_name || null,
                            status: 'posted',
                        });
                        remaining -= deduct;
                    }
                }
            } catch (_) { /* non-fatal */ }

            return tx;
        },
        onSuccess: (tx) => {
            setLastTransaction(tx);
            setShowReceipt(true);
            setCart([]);
            setCustomerName("");
            setCustomerPhone("");
            setCashReceived("");
            setDiscountPercent(0);
            queryClient.invalidateQueries({ queryKey: ['posTransactions'] });
            queryClient.invalidateQueries({ queryKey: ['stockLevels'] });
            toast({ title: "Sale Completed!", description: `Transaction ${tx.transaction_number} recorded.` });
        }
    });

    const handleCheckout = () => {
        if (cart.length === 0) {
            toast({ title: "Empty Cart", description: "Please add items before checkout.", variant: "destructive" });
            return;
        }
        if (paymentMethod === 'cash' && parseFloat(cashReceived || 0) < totalAmount) {
            toast({ title: "Insufficient Cash", description: "Cash received is less than total.", variant: "destructive" });
            return;
        }
        createTransactionMutation.mutate({
            transaction_number: generateTxNumber(),
            transaction_date: new Date().toISOString(),
            cashier_name: "Cashier",
            customer_name: customerName || "Walk-in Customer",
            customer_phone: customerPhone,
            items: cart,
            subtotal: cartSubtotal,
            discount_amount: discountAmount,
            vat_amount: vatAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            cash_received: parseFloat(cashReceived || 0),
            change_given: changeGiven,
            status: "completed"
        });
    };

    // Stats
    const today = new Date().toISOString().split('T')[0];
    const todayTx = transactions.filter(t => t.transaction_date?.startsWith(today));
    const todaySales = todayTx.reduce((s, t) => s + (t.total_amount || 0), 0);
    const monthTx = transactions.filter(t => t.transaction_date?.startsWith(new Date().toISOString().slice(0, 7)));
    const monthSales = monthTx.reduce((s, t) => s + (t.total_amount || 0), 0);
    const totalVAT = transactions.reduce((s, t) => s + (t.vat_amount || 0), 0);

    const txColumns = [
        { header: "Tx #", key: "transaction_number" },
        { header: "Date", key: "transaction_date", render: (v) => v ? new Date(v).toLocaleString() : '-' },
        { header: "Customer", key: "customer_name" },
        { header: "Items", key: "items", render: (v) => v?.length || 0 },
        { header: "Total (LKR)", key: "total_amount", render: (v) => v?.toFixed(2) },
        { header: "Payment", key: "payment_method", isBadge: true },
        { header: "Status", key: "status", isBadge: true }
    ];

    const getBadgeColor = (v) => ({
        completed: "bg-green-100 text-green-800",
        voided: "bg-red-100 text-red-800",
        refunded: "bg-yellow-100 text-yellow-800",
        cash: "bg-blue-100 text-blue-800",
        card: "bg-purple-100 text-purple-800",
        bank_transfer: "bg-indigo-100 text-indigo-800",
        split: "bg-orange-100 text-orange-800"
    }[v] || "bg-gray-100 text-gray-800");

    return (
        <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">

            {/* ── Top Bar ── */}
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 p-1.5 rounded-lg">
                        <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-none">Point of Sale</h1>
                        <p className="text-xs text-gray-400">ZATCA-compliant retail register</p>
                    </div>
                </div>

                {/* Quick-link shortcuts to integrated modules */}
                <div className="flex items-center gap-2">
                    {/* Barcode mode indicator */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${barcodeBuffer ? 'bg-amber-50 border-amber-400 text-amber-700 animate-pulse' : 'bg-green-50 border-green-300 text-green-700'}`}>
                        <Scan className="w-3.5 h-3.5" />
                        {barcodeBuffer ? `Scanning: ${barcodeBuffer}` : "Scanner Ready"}
                    </div>

                    <Link to="/Inventory">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Boxes className="w-3.5 h-3.5 text-blue-600" /> Inventory
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                        </Button>
                    </Link>
                    <Link to="/ZATCA">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" /> VAT / ZATCA
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                        </Button>
                    </Link>

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="h-8">
                            <TabsTrigger value="register" className="text-xs px-3">Register</TabsTrigger>
                            <TabsTrigger value="transactions" className="text-xs px-3">History</TabsTrigger>
                            <TabsTrigger value="summary" className="text-xs px-3">Summary</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">

                {/* ══════════════════════════════════════
                    REGISTER TAB
                    ══════════════════════════════════════ */}
                <TabsContent value="register" className="h-full m-0 overflow-hidden">
                    <div className="flex h-full gap-0">

                        {/* LEFT — Product browser */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 p-3 gap-3">

                            {/* Search + barcode input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    ref={searchRef}
                                    placeholder="Search by name or scan barcode…"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 h-11 text-sm bg-white shadow-sm"
                                />
                                <Scan className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            </div>

                            {/* Category filter — large touch targets */}
                            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all capitalize ${activeCategory === cat
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
                                        }`}
                                    >
                                        {cat === 'all' ? '🗂 All' : cat.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>

                            {/* Touch-friendly product grid */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.code}
                                            onClick={() => addToCart(item)}
                                            className="group relative flex flex-col rounded-2xl overflow-hidden shadow-sm hover:shadow-xl active:scale-95 transition-all duration-150 border-2 border-transparent hover:border-emerald-400 bg-white text-left"
                                            style={{ minHeight: 130 }}
                                        >
                                            {/* Color header by category */}
                                            <div className={`bg-gradient-to-br ${getCategoryColor(item.category)} h-14 flex items-center justify-center`}>
                                                <Package className="w-7 h-7 text-white/90" />
                                            </div>
                                            <div className="p-2.5 flex-1">
                                                <p className="text-xs font-bold text-gray-800 leading-tight line-clamp-2">{item.name}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{item.code}</p>
                                                <p className="text-sm font-extrabold text-emerald-700 mt-1">LKR {item.price?.toFixed(2)}</p>
                                            </div>
                                            {/* Stock badge */}
                                            {item.stock !== undefined && (
                                                <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.stock <= 0 ? 'bg-red-100 text-red-600' : item.stock < 5 ? 'bg-amber-100 text-amber-700' : 'bg-white/80 text-gray-500'}`}>
                                                    {item.stock <= 0 ? 'Out' : `×${item.stock}`}
                                                </div>
                                            )}
                                            {/* Add overlay on hover */}
                                            <div className="absolute inset-0 bg-emerald-600/0 group-hover:bg-emerald-600/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg">
                                                    <Plus className="w-5 h-5 text-white" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <div className="col-span-5 text-center py-16 text-gray-400">
                                            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p>No products found</p>
                                            <Link to="/Inventory" className="text-xs text-emerald-600 underline mt-1 inline-block">Manage inventory →</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT — Cart & Checkout panel */}
                        <div className="w-80 xl:w-96 bg-white border-l flex flex-col shrink-0 shadow-xl">

                            {/* Customer info */}
                            <div className="p-3 border-b bg-gray-50">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input placeholder="Name (optional)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 text-sm" />
                                    <Input placeholder="Phone (optional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-9 text-sm" />
                                </div>
                            </div>

                            {/* Cart header */}
                            <div className="px-4 py-2 border-b flex items-center justify-between bg-white">
                                <span className="font-semibold text-sm flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                                    Cart
                                    {cart.length > 0 && <Badge className="bg-emerald-600 text-white text-xs px-1.5 py-0">{cart.length}</Badge>}
                                </span>
                                {cart.length > 0 && (
                                    <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                                        <RotateCcw className="w-3 h-3" /> Clear
                                    </button>
                                )}
                            </div>

                            {/* Cart items — scrollable */}
                            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                                {cart.length === 0 && (
                                    <div className="text-center py-12 text-gray-300">
                                        <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
                                        <p className="text-sm">Tap a product or scan a barcode</p>
                                    </div>
                                )}
                                {cart.map(item => (
                                    <div key={item.product_code} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{item.product_name}</p>
                                            <p className="text-xs text-gray-400">LKR {item.unit_price?.toFixed(2)} each</p>
                                        </div>
                                        {/* Touch-friendly qty buttons */}
                                        <div className="flex items-center gap-0.5">
                                            <button onClick={() => updateQty(item.product_code, -1)} className="w-7 h-7 rounded-lg bg-white border text-gray-500 flex items-center justify-center hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all">
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                                            <button onClick={() => updateQty(item.product_code, 1)} className="w-7 h-7 rounded-lg bg-white border text-gray-500 flex items-center justify-center hover:bg-emerald-50 hover:border-emerald-300 active:scale-90 transition-all">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <p className="text-sm font-bold text-emerald-700 w-16 text-right shrink-0">LKR {item.line_total?.toFixed(2)}</p>
                                        <button onClick={() => removeFromCart(item.product_code)} className="text-gray-300 hover:text-red-400 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Discount & Totals */}
                            <div className="px-3 py-2 border-t bg-gray-50 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-xs text-gray-500">Discount %</span>
                                    <Input
                                        type="number" min="0" max="100"
                                        value={discountPercent}
                                        onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                                        className="h-7 text-sm ml-auto w-20 text-right"
                                    />
                                </div>
                                <div className="space-y-0.5 text-sm">
                                    <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>LKR {cartSubtotal.toFixed(2)}</span></div>
                                    {discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({discountPercent}%)</span><span>−LKR {discountAmount.toFixed(2)}</span></div>}
                                    <div className="flex justify-between text-gray-500"><span>VAT 18%</span><span>LKR {vatAmount.toFixed(2)}</span></div>
                                </div>
                                <div className="flex justify-between font-extrabold text-xl border-t pt-1.5 text-emerald-700">
                                    <span>Total</span><span>LKR {totalAmount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Payment method — large touch buttons */}
                            <div className="px-3 pb-2 space-y-2">
                                <div className="grid grid-cols-3 gap-1.5 mt-2">
                                    {[
                                        { key: 'cash', label: 'Cash', icon: '💵' },
                                        { key: 'card', label: 'Card', icon: '💳' },
                                        { key: 'bank_transfer', label: 'Transfer', icon: '🏦' },
                                    ].map(m => (
                                        <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                                            className={`py-3 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${paymentMethod === m.key
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-400'
                                            }`}>
                                            <div className="text-base">{m.icon}</div>
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {paymentMethod === 'cash' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 whitespace-nowrap">Received LKR</span>
                                        <Input type="number" placeholder="0.00" value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            className="h-9 text-sm font-bold text-right" />
                                    </div>
                                )}

                                {paymentMethod === 'cash' && parseFloat(cashReceived || 0) >= totalAmount && totalAmount > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2 text-center text-blue-700 font-bold text-base">
                                        Change: LKR {changeGiven.toFixed(2)}
                                    </div>
                                )}

                                {/* Checkout button */}
                                <Button
                                    onClick={handleCheckout}
                                    disabled={cart.length === 0 || createTransactionMutation.isPending}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 h-14 text-lg font-extrabold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <CheckCircle2 className="w-5 h-5 mr-2" />
                                    {createTransactionMutation.isPending ? "Processing…" : `Charge LKR ${totalAmount.toFixed(2)}`}
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ══════════════════════════════════════
                    TRANSACTIONS TAB
                    ══════════════════════════════════════ */}
                <TabsContent value="transactions" className="p-4 m-0 overflow-auto h-full">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent POS Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                data={transactions}
                                columns={txColumns}
                                getBadgeColor={getBadgeColor}
                                searchFields={['transaction_number', 'customer_name']}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ══════════════════════════════════════
                    SUMMARY TAB
                    ══════════════════════════════════════ */}
                <TabsContent value="summary" className="p-4 m-0 overflow-auto h-full space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    </div>

                    {/* Integration shortcuts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Link to="/Inventory">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-blue-100 hover:border-blue-300">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="bg-blue-100 p-3 rounded-xl">
                                        <Boxes className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">Inventory Management</p>
                                        <p className="text-xs text-gray-500">View stock levels, stock movements and reorder points</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                                </CardContent>
                            </Card>
                        </Link>
                        <Link to="/ZATCA">
                            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-emerald-100 hover:border-emerald-300">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="bg-emerald-100 p-3 rounded-xl">
                                        <FileText className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800">VAT & ZATCA Dashboard</p>
                                        <p className="text-xs text-gray-500">File VAT returns and view tax summary from POS sales</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                                </CardContent>
                            </Card>
                        </Link>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>All Transactions</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable
                                data={transactions}
                                columns={txColumns}
                                getBadgeColor={getBadgeColor}
                                searchFields={['transaction_number', 'customer_name', 'payment_method']}
                                filterOptions={[
                                    { key: 'status', label: 'Status', options: ['completed', 'voided', 'refunded'] },
                                    { key: 'payment_method', label: 'Payment', options: ['cash', 'card', 'bank_transfer'] }
                                ]}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Receipt Modal ── */}
            {showReceipt && lastTransaction && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h2 className="text-2xl font-extrabold">Sale Complete!</h2>
                            <p className="text-gray-400 text-sm font-mono">{lastTransaction.transaction_number}</p>
                        </div>
                        <div className="border rounded-xl p-4 space-y-2 text-sm bg-gray-50">
                            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{lastTransaction.customer_name}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Items</span><span>{lastTransaction.items?.length}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>LKR {lastTransaction.subtotal?.toFixed(2)}</span></div>
                            {lastTransaction.discount_amount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>−LKR {lastTransaction.discount_amount?.toFixed(2)}</span></div>}
                            <div className="flex justify-between"><span className="text-gray-500">VAT 18%</span><span>LKR {lastTransaction.vat_amount?.toFixed(2)}</span></div>
                            <div className="flex justify-between font-extrabold text-lg border-t pt-2"><span>Total</span><span className="text-emerald-700">LKR {lastTransaction.total_amount?.toFixed(2)}</span></div>
                            {lastTransaction.payment_method === 'cash' && lastTransaction.change_given > 0 && (
                                <div className="flex justify-between text-blue-600 font-bold"><span>Change</span><span>LKR {lastTransaction.change_given?.toFixed(2)}</span></div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 gap-2 h-11" onClick={() => window.print()}>
                                <Printer className="w-4 h-4" /> Print Receipt
                            </Button>
                            <Button className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => setShowReceipt(false)}>
                                <Zap className="w-4 h-4 mr-1" /> New Sale
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}