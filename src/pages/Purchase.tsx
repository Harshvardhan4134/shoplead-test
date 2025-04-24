import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";
import { db } from "@/lib/db";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface PurchaseOrder {
  id: number;
  po_number: string;
  job_id: number | null;
  vendor: string;
  amount: number;
  status: string;
  issue_date: string;
  expected_date: string | null;
  received_date: string | null;
  notes: string | null;
  description: string | null;
  severity: string | null;
}

const Purchase = () => {
  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchaseOrders"],
    queryFn: async () => {
      try {
        console.log('Fetching purchase orders...');
        const pos = await db.getPurchaseOrders();
        console.log('Fetched purchase orders:', pos);
        return pos;
      } catch (error) {
        console.error('Error fetching purchase orders:', error);
        return [];
      }
    }
  });

  // Calculate summary data
  const openPOs = purchaseOrders.filter(po => po.status === "Open").length;
  const totalValue = purchaseOrders.reduce((sum, po) => sum + (po.amount || 0), 0);
  const pendingDeliveries = purchaseOrders.filter(po =>
    po.status === "In Progress" && (!po.received_date || new Date(po.received_date) > new Date())
  ).length;
  const lateDeliveries = purchaseOrders.filter(po =>
    po.expected_date && new Date(po.expected_date) < new Date() && po.status !== "Received"
  ).length;

  // Prepare chart data
  const statusData = [
    { name: 'Open', value: purchaseOrders.filter(po => po.status === "Open").length, color: '#10b981' },
    { name: 'In Progress', value: purchaseOrders.filter(po => po.status === "In Progress").length, color: '#3b82f6' },
    { name: 'Received', value: purchaseOrders.filter(po => po.status === "Received").length, color: '#f59e0b' },
    { name: 'Delayed', value: lateDeliveries, color: '#ef4444' },
  ];

  // Prepare delivery timeline data
  const deliveryData = purchaseOrders
    .filter(po => po.expected_date)
    .map(po => ({
      date: format(new Date(po.expected_date!), "MMM d"),
      count: 1
    }))
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) {
        existing.count++;
      } else {
        acc.push(curr);
      }
      return acc;
    }, [] as { date: string; count: number }[])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 7);

  if (isLoadingPOs) {
    return (
      <div className="container mx-auto p-6">
        <LoadingSpinner message="Loading purchase data..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Purchase Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500">Open POs</div>
            <div className="text-4xl font-bold mt-1">{openPOs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-4xl font-bold mt-1">${totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500">Pending Deliveries</div>
            <div className="text-4xl font-bold mt-1">{pendingDeliveries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-500">Late Deliveries</div>
            <div className="text-4xl font-bold mt-1">{lateDeliveries}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Purchase Orders by Status */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Purchase Orders by Status</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center mt-4 gap-4">
                {statusData.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-3 h-3 mr-1" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Timeline */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Delivery Timeline (Next 7 Days)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deliveryData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Purchase Orders</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Job Number</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                      No purchase orders found. Click "Insert Test Data" to add sample data.
                    </TableCell>
                  </TableRow>
                ) : (
                  purchaseOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.po_number}</TableCell>
                      <TableCell>{order.vendor}</TableCell>
                      <TableCell>{order.job_id || "-"}</TableCell>
                      <TableCell>{format(new Date(order.issue_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        {order.expected_date ? format(new Date(order.expected_date), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${order.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'Open'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                        >
                          {order.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">${order.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchase;
