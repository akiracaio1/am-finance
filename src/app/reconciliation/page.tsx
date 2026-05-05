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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Link2, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  RefreshCw,
  Search,
  Check,
  X
} from "lucide-react";
import { MOCK_OFX_ITEMS, MOCK_ENTRIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ReconciliationPage() {
  const [items, setItems] = useState(MOCK_OFX_ITEMS);

  const handleMatch = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, matchedEntryId: 'matched' } : item
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Link2 className="text-primary w-8 h-8" />
            Bank Reconciliation
          </h1>
          <p className="text-muted-foreground">Match your bank statements with accounting records.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Run Auto-Match
          </Button>
          <Button className="gap-2">
            <Upload className="w-4 h-4" /> Import OFX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader>
            <CardTitle className="text-primary">Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-around py-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Unreconciled</p>
              <div className="text-3xl font-bold">2</div>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Automatically Matched</p>
              <div className="text-3xl font-bold text-emerald-600">1</div>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase mb-1">Difference</p>
              <div className="text-3xl font-bold text-destructive">$ 0.00</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-accent/5 border-accent/10">
          <CardHeader>
            <CardTitle className="text-accent">Matching Engine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Our system analyzes bank description, transaction date (±2 days), and exact value to suggest matches. 
              Confirm valid matches below to reconcile your books.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bank Statement vs. Accounting Entries</CardTitle>
          <CardDescription>Review transactions imported from your OFX file.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Bank Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Suggested Match</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className={cn(item.matchedEntryId ? "bg-emerald-50/30" : "")}>
                  <TableCell className="font-mono text-xs">{item.date}</TableCell>
                  <TableCell className="font-medium text-sm">{item.description}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    item.amount < 0 ? "text-destructive" : "text-accent"
                  )}>
                    $ {Math.abs(item.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {item.matchedEntryId ? (
                      <div className="flex items-center gap-2 text-emerald-700 text-sm">
                        <CheckCircle className="w-4 h-4" /> 
                        Matched with accounting entry
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[10px] py-0 px-2 uppercase text-muted-foreground">Confidence: High</Badge>
                        <p className="text-xs text-primary font-bold">Peixaria Central - $1,500.00 (Due: 2024-03-20)</p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.matchedEntryId ? (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Unmatch">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-2">
                         <Button variant="outline" size="sm" className="h-8 gap-1">
                          <Search className="w-3 h-3" /> Find
                        </Button>
                        <Button 
                          onClick={() => handleMatch(item.id)} 
                          size="sm" 
                          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check className="w-3 h-3" /> Confirm
                        </Button>
                      </div>
                    )}
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
