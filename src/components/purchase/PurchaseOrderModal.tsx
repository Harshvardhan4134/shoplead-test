import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { db } from '@/lib/db';
import { useQuery } from '@tanstack/react-query';
import { PurchaseOrder } from "@/shared/schema";
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, CircleDashed, FileText, Truck, DollarSign, BarChart4, Upload, Paperclip, Download } from 'lucide-react';

interface PurchaseOrderModalProps {
    poNumber: string | null;
    purchaseOrder?: PurchaseOrder | null;
    allPurchaseOrders?: PurchaseOrder[];
    isOpen: boolean;
    onClose: () => void;
}

export function PurchaseOrderModal({ 
    poNumber, 
    purchaseOrder: propPurchaseOrder, 
    allPurchaseOrders = [], 
    isOpen, 
    onClose 
}: PurchaseOrderModalProps) {
    const {
        data: fetchedPurchaseOrders,
        isLoading,
        error,
        refetch
    } = useQuery<PurchaseOrder[]>({
        queryKey: ['purchase-order', poNumber],
        queryFn: async () => {
            if (!poNumber) return [];
            try {
                // Get all purchase orders with the same PO number
                // Use the existing method but we'll handle grouping in the component
                const poData = await db.getPurchaseOrderByNumber(poNumber);
                return propPurchaseOrder ? [propPurchaseOrder] : (poData ? [poData] : []);
            } catch (error) {
                console.error('Error fetching purchase order:', error);
                throw error;
            }
        },
        enabled: isOpen && !!poNumber && allPurchaseOrders.length === 0 && !propPurchaseOrder,
        staleTime: 30000
    });

    // Use the provided purchase orders if available, otherwise use the fetched data
    // If we have a single PO passed in and no array, convert to array for consistent handling
    const purchaseOrders = allPurchaseOrders.length > 0 
        ? allPurchaseOrders 
        : (propPurchaseOrder ? [propPurchaseOrder] : (fetchedPurchaseOrders || []));
    
    // Get the first PO for header information (they should all share the same header info)
    const mainPurchaseOrder = purchaseOrders.length > 0 ? purchaseOrders[0] : null;

    // Add state for document attachments
    const [attachments, setAttachments] = useState<Array<{name: string, url: string}>>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setIsUploading(true);
        // In a real app, you'd upload to a server here
        // For now, simulate with local URLs
        const newAttachments = Array.from(files).map(file => ({
            name: file.name,
            url: URL.createObjectURL(file)
        }));
        
        // Add new attachments to existing list
        setAttachments(prev => [...prev, ...newAttachments]);
        setIsUploading(false);
        
        // Clear input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    useEffect(() => {
        if (error) {
            console.error('Error in PurchaseOrderModal:', error);
        }
    }, [error]);

    useEffect(() => {
        if (poNumber && isOpen) {
            console.log('Fetching purchase order details for:', poNumber);
        }
    }, [poNumber, isOpen]);

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
            case 'open':
                return <Badge className="bg-blue-100 text-blue-800"><CircleDashed className="h-3 w-3 mr-1" /> {status}</Badge>;
            case 'cancelled':
                return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" /> {status}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const errorMessage = error instanceof Error ? error.message : 'Failed to load purchase order details';

    // Add document attachment card to the component return
    const renderDocumentAttachmentsCard = () => (
        <Card>
            <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center">
                    <Paperclip className="h-4 w-4 mr-2" />
                    Document Attachments
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            multiple
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {isUploading ? "Uploading..." : "Attach Documents"}
                        </Button>
                    </div>
                    
                    {attachments.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                            No documents attached
                        </div>
                    ) : (
                        <div className="space-y-2 mt-4">
                            {attachments.map((attachment, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                                >
                                    <div className="flex items-center">
                                        <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                        <span className="text-sm font-medium">{attachment.name}</span>
                                    </div>
                                    <a
                                        href={attachment.url}
                                        download={attachment.name}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-700"
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogTitle className="flex items-center gap-2">
                    <span>Purchase Order Details</span>
                    {poNumber && (
                        <span className="text-sm text-gray-500">#{poNumber}</span>
                    )}
                </DialogTitle>
                <DialogDescription>
                    {poNumber ? `Viewing details for purchase order: ${poNumber}` : 'No purchase order selected'}
                </DialogDescription>

                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading purchase order details...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <div className="text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-destructive mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-destructive text-lg font-medium mb-2">Error Loading Purchase Order Details</p>
                            <p className="text-gray-600 mb-4">{errorMessage}</p>
                            <Button
                                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                                onClick={() => refetch()}
                            >
                                Retry
                            </Button>
                        </div>
                    </div>
                ) : !mainPurchaseOrder ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-center">
                            <p className="text-gray-600">No purchase order data found for: {poNumber}</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Main PO Information Card */}
                        <Card>
                            <CardHeader className="bg-blue-50 py-4">
                                <CardTitle className="flex justify-between">
                                    <span>PO #{mainPurchaseOrder.purchasing_document}</span>
                                    <div>
                                        {getStatusBadge(mainPurchaseOrder.status)}
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Vendor</h3>
                                        <p className="text-base">{mainPurchaseOrder.vendor}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Document Date</h3>
                                        <p className="text-base">
                                            {mainPurchaseOrder.document_date ? 
                                                format(new Date(mainPurchaseOrder.document_date), 'MMM dd, yyyy') : 
                                                'Not set'}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Purchasing Group</h3>
                                        <p className="text-base">{mainPurchaseOrder.purchasing_group || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Req. Tracking #</h3>
                                        <p className="text-base">{mainPurchaseOrder.req_tracking_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Net Price</h3>
                                        <p className="text-base font-medium text-green-700">
                                            ${mainPurchaseOrder.net_price ? mainPurchaseOrder.net_price.toFixed(2) : '0.00'}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Item Description</h3>
                                        <p className="text-base">{mainPurchaseOrder.short_text || 'No description'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order Details Card */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-base flex items-center">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Order Details {purchaseOrders.length > 1 && 
                                        <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                            {purchaseOrders.length} items
                                        </span>
                                    }
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Ordered Quantity</TableHead>
                                            <TableHead>Remaining Quantity</TableHead>
                                            <TableHead>Net Price</TableHead>
                                            <TableHead>Remaining Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {purchaseOrders.map((po, index) => (
                                            <TableRow key={`${po.id}-${index}`}>
                                                <TableCell>{po.item || index + 1}</TableCell>
                                                <TableCell>{po.material || 'N/A'}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={po.short_text || 'No description'}>
                                                    {po.short_text || 'No description'}
                                                </TableCell>
                                                <TableCell>{po.order_quantity || 0}</TableCell>
                                                <TableCell>{po.remaining_quantity || 0}</TableCell>
                                                <TableCell>${po.net_price ? po.net_price.toFixed(2) : '0.00'}</TableCell>
                                                <TableCell>${po.remaining_value ? po.remaining_value.toFixed(2) : '0.00'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Related Job Section */}
                        {mainPurchaseOrder.req_tracking_number && (
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-base flex items-center">
                                        <BarChart4 className="h-4 w-4 mr-2" />
                                        Related Job
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <p className="text-sm">
                                        This purchase order is associated with Job <strong>#{mainPurchaseOrder.req_tracking_number}</strong>
                                    </p>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="mt-2"
                                        onClick={() => {
                                            onClose();
                                            // Navigate to job details
                                            // This is a placeholder - actual navigation would depend on your routing setup
                                            console.log(`Navigate to job ${mainPurchaseOrder.req_tracking_number}`);
                                        }}
                                    >
                                        View Job Details
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Delivery/Shipment Status Card */}
                        <Card>
                            <CardHeader className="py-3">
                                <CardTitle className="text-base flex items-center">
                                    <Truck className="h-4 w-4 mr-2" />
                                    Delivery Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="p-4 rounded bg-gray-50">
                                    <div className="flex justify-between">
                                        <div>
                                            <div className="text-sm font-medium">Status</div>
                                            <div>{getStatusBadge(mainPurchaseOrder.status)}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Ordered Quantity</div>
                                            <div>{mainPurchaseOrder.order_quantity || 0}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Delivered</div>
                                            <div>{Math.max(0, (mainPurchaseOrder.order_quantity || 0) - (mainPurchaseOrder.remaining_quantity || 0))}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">Pending</div>
                                            <div>{mainPurchaseOrder.remaining_quantity || 0}</div>
                                        </div>
                                    </div>
                                    
                                    {/* Simple progress bar */}
                                    <div className="mt-4">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div 
                                                className="bg-blue-600 h-2.5 rounded-full"
                                                style={{ 
                                                    width: `${mainPurchaseOrder.order_quantity && mainPurchaseOrder.remaining_quantity ? 
                                                        Math.min(100, ((mainPurchaseOrder.order_quantity - mainPurchaseOrder.remaining_quantity) / mainPurchaseOrder.order_quantity) * 100) : 
                                                        0}%` 
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Document Attachments Card */}
                        {renderDocumentAttachmentsCard()}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
} 