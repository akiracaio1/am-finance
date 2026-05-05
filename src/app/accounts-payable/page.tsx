"use client";

import { useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  ArrowDownCircle, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar,
  FileText
} from "lucide-react";
import { MOCK_ENTRIES, MOCK_SUPPLIERS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function AccountsPayablePage() {
  const [filterStatus, setFilterStatus] = useState("all");
  
  const entries = MOCK_ENTRIES.filter(e => e.type === 'payable');
  const filteredEntries = filterStatus === 'all' 
    ? entries 
    : entries.filter(e => e.status === filterStatus);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="border-none"><AlertTriangle className="w-3 h-3 mr-1" /> Overdue</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground"><Calendar className="w-3 h-3 mr-1" /> Open</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowDownCircle className="text-destructive w-8 h-8" />
            Accounts Payable
          </h1>
          <p className="text-muted-foreground">Track and manage your upcoming expenses and bills.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" /> Batch Import
          </Button>
          <Button className="gap-2">
            New Launch
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive/80">Total Overdue</p>
            <div className="text-2xl font-bold text-destructive">$ 4,500.00</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-primary/80">Pending Next 7 Days</p>
            <div className="text-2xl font-bold text-primary">$ 350.00</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-emerald-700">Paid this Month</p>
            <div className="text-2xl font-bold text-emerald-800">$ 1,500.00</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Expenses List</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id} className="group">
                  <TableCell className="font-mono text-sm">
                    {new Date(entry.dueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {MOCK_SUPPLIERS.find(s => s.id === entry.supplierId)?.name || 'N/A'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <span className="text-muted-foreground text-xs block uppercase tracking-wider">{entry.category}</span>
                    {entry.description}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(entry.status)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    entry.status === 'overdue' ? "text-destructive" : ""
                  )}>
                    $ {entry.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
