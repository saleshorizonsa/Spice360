
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package2, MapPin, User, Wrench, Edit, QrCode, Trash2 } from "lucide-react";

export default function AssetCard({ asset, onEdit, onAllocate, onMaintenance, onPrintTag, onDispose }) {
    const depreciationPercent = asset.acquisition_cost > 0
        ? ((asset.accumulated_depreciation || 0) / asset.acquisition_cost) * 100
        : 0;

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {asset.asset_tag}
                            </span>
                        </div>
                        <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{asset.asset_number}</p>
                        <div className="flex gap-2 mt-2">
                            <Badge>{asset.asset_class}</Badge>
                            <Badge className={
                                asset.status === 'active' ? 'bg-green-100 text-green-800' :
                                asset.status === 'under_maintenance' ? 'bg-yellow-100 text-yellow-800' :
                                asset.status === 'sold' ? 'bg-blue-100 text-blue-800' :
                                asset.status === 'retired' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                            }>
                                {asset.status}
                            </Badge>
                        </div>
                    </div>
                    <Package2 className="w-5 h-5 text-emerald-600" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Valuation */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded">
                        <p className="text-xs text-gray-500">Acquisition Cost</p>
                        <p className="text-sm font-bold">LKR {asset.acquisition_cost?.toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded">
                        <p className="text-xs text-gray-500">Net Book Value</p>
                        <p className="text-sm font-bold text-emerald-700">LKR {asset.net_book_value?.toLocaleString()}</p>
                    </div>
                </div>

                {/* Depreciation */}
                <div className="bg-blue-50 p-3 rounded">
                    <p className="text-xs text-blue-700">Accumulated Depreciation</p>
                    <p className="text-sm font-bold text-blue-900">
                        LKR {asset.accumulated_depreciation?.toLocaleString()} ({depreciationPercent.toFixed(0)}%)
                    </p>
                </div>

                {/* Details */}
                <div className="space-y-2 pt-2 border-t text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{asset.location_code || 'No location'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{asset.responsible_person || 'Unassigned'}</span>
                    </div>
                    {asset.last_scanned_date && (
                        <div className="text-xs text-gray-500">
                            Last scanned: {new Date(asset.last_scanned_date).toLocaleDateString()}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t flex-wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(asset)}
                        className="flex-1"
                    >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                    </Button>
                    {onPrintTag && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPrintTag(asset)}
                            className="flex-1"
                        >
                            <QrCode className="w-3 h-3 mr-1" />
                            Tag
                        </Button>
                    )}
                    {asset.status === 'active' && onAllocate && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAllocate(asset)}
                            className="flex-1"
                        >
                            <User className="w-3 h-3 mr-1" />
                            Allocate
                        </Button>
                    )}
                    {asset.status === 'active' && onMaintenance && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onMaintenance(asset)}
                            className="flex-1"
                        >
                            <Wrench className="w-3 h-3 mr-1" />
                            Maintain
                        </Button>
                    )}
                    {asset.status === 'active' && onDispose && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDispose(asset)}
                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Dispose
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
