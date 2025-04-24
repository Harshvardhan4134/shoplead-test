import * as XLSX from 'xlsx';

export async function parseExcelFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

export function mapSAPData(row: any) {
  return {
    jobNumber: String(row["Order"]),
    title: String(row["Opr. short text"] || row["Description"] || ""),
    description: String(row["Description"] || ""),
    status: "New",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    progress: Number(row["Actual work"]) || 0,
    workCenter: String(row["Oper.WorkCenter"] || ""),
    customer: String(row["List name"] || ""),
    utilization: Number(row["Utilization"]) || 0,
    capacity: Number(row["Capacity"]) || 0
  };
}

export function mapPurchaseOrders(row: any) {
  return {
    id: parseInt(row["Purchasing Document"]),
    jobNumber: String(row["Order"]),
    vendor: String(row["Vendor/supplying plant"] || ""),
    orderDate: row["Document Date"] || new Date().toISOString(),
    deliveryDate: row["Delivery Date"] || new Date().toISOString(),
    status: "New",
    items: [{
      material: String(row["Material"] || ""),
      quantity: Number(row["Order Quantity"]) || 0,
      price: Number(row["Net price"]) || 0
    }]
  };
}

export function mapWorkLog(row: any) {
  return {
    id: parseInt(row["ID"]),
    jobNumber: String(row["Order"]),
    date: row["PostingDate"] || new Date().toISOString(),
    status: "Completed",
    notes: `${row["Operation Short Text"] || ""} - By: ${row["EmployeeName"] || ""}`
  };
} 