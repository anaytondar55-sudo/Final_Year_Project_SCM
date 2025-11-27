"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { SettingsSheet } from "./SettingsSheet";
import { SheetTrigger } from "@/components/ui/sheet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label as RechartsLabel,
} from "recharts";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
};

export function SupplyChainCalculator() {
  const [inputs, setInputs] = useState({
    sellingPrice: '40000',
    manufacturingCostPerTon: '29000',
    storageCostPercent: '1.75',
    transportationCostPercent: '1.3',
    sustainabilityCostPerTonCO2: '300',
    co2EmissionFactor: '2.53',
    productionVolume: '50000',
    salesVolume: '50000',
    salesVolumePercent: '100',
    inventoryVolume: '0',
    inventoryVolumePercent: '0',
  });

  const [hyperparameters, setHyperparameters] = useState({
    maxInventory: 60000,
    maxProduction: 60000,
    maxSales: 60000,
    maxEmissions: 150000,
  });

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [volumeMode, setVolumeMode] = useState<'tons' | 'percent'>('tons');

  const [results, setResults] = useState({
    revenue: 0,
    manufacturingCost: 0,
    storageCost: 0,
    transportationCost: 0,
    totalEmissions: 0,
    sustainabilityCost: 0,
    totalCost: 0,
    netProfit: 0,
  });

  const [constraints, setConstraints] = useState({
    inventory: true,
    production: true,
    sales: true,
    emissions: true,
  });

  const [analysisData, setAnalysisData] = useState<any[]>([]);
  
  const p = (v: string) => parseFloat(v) || 0;

  useEffect(() => {
    const sellingPrice = p(inputs.sellingPrice);
    const manufacturingCostPerTon = p(inputs.manufacturingCostPerTon);
    const storageCostPercent = p(inputs.storageCostPercent);
    const transportationCostPercent = p(inputs.transportationCostPercent);
    const sustainabilityCostPerTonCO2 = p(inputs.sustainabilityCostPerTonCO2);
    const co2EmissionFactor = p(inputs.co2EmissionFactor);
    const productionVolume = p(inputs.productionVolume);
    const salesVolume = p(inputs.salesVolume);
    const inventoryVolume = p(inputs.inventoryVolume);

    const revenue = sellingPrice * salesVolume;
    const manufacturingCost = manufacturingCostPerTon * productionVolume;
    const storageCost = sellingPrice * (storageCostPercent / 100) * inventoryVolume;
    const transportationCost = sellingPrice * (transportationCostPercent / 100) * productionVolume;
    const totalEmissions = co2EmissionFactor * productionVolume;
    const sustainabilityCost = sustainabilityCostPerTonCO2 * totalEmissions;
    const totalCost = manufacturingCost + storageCost + transportationCost + sustainabilityCost;
    const netProfit = revenue - totalCost;

    setResults({
      revenue,
      manufacturingCost,
      storageCost,
      transportationCost,
      totalEmissions,
      sustainabilityCost,
      totalCost,
      netProfit,
    });

    setConstraints({
      inventory: inventoryVolume <= hyperparameters.maxInventory,
      production: productionVolume <= hyperparameters.maxProduction,
      sales: salesVolume <= hyperparameters.maxSales,
      emissions: totalEmissions <= hyperparameters.maxEmissions,
    });

  }, [inputs, hyperparameters]);

  useEffect(() => {
    const calculateAnalysisData = () => {
      const rawData = [];
      
      const sellingPrice = p(inputs.sellingPrice);
      const manufacturingCostPerTon = p(inputs.manufacturingCostPerTon);
      const storageCostPercent = p(inputs.storageCostPercent);
      const transportationCostPercent = p(inputs.transportationCostPercent);
      const sustainabilityCostPerTonCO2 = p(inputs.sustainabilityCostPerTonCO2);
      const co2EmissionFactor = p(inputs.co2EmissionFactor);
      const productionVolume = p(inputs.productionVolume);

      if (productionVolume === 0) {
        setAnalysisData([]);
        return;
      }

      for (let salesPercent = 65; salesPercent <= 100; salesPercent += 1) {
        const salesVolume = productionVolume * (salesPercent / 100);
        const inventoryVolume = productionVolume - salesVolume;

        const revenue = sellingPrice * salesVolume;
        const manufacturingCost = manufacturingCostPerTon * productionVolume;
        const storageCost = sellingPrice * (storageCostPercent / 100) * inventoryVolume;
        const transportationCost = sellingPrice * (transportationCostPercent / 100) * productionVolume;
        const totalEmissions = co2EmissionFactor * productionVolume;
        const sustainabilityCost = sustainabilityCostPerTonCO2 * totalEmissions;
        const totalCost = manufacturingCost + storageCost + transportationCost + sustainabilityCost;
        const netProfit = revenue - totalCost;

        rawData.push({
          salesPercent,
          productionVolume,
          salesVolume,
          manufacturingCost,
          sustainabilityCost,
          totalCost,
          revenue,
          netProfit,
          totalEmissions,
        });
      }

      const processedData = [];
      const transformPoint = (point: any) => ({
        ...point,
        netProfitPositive: point.netProfit >= 0 ? point.netProfit : null,
        netProfitNegative: point.netProfit < 0 ? point.netProfit : null,
      });

      for (let i = 0; i < rawData.length; i++) {
        const currentPoint = rawData[i];

        if (i > 0) {
          const prevPoint = rawData[i - 1];
          if (prevPoint.netProfit * currentPoint.netProfit < 0) {
            const y1 = prevPoint.netProfit;
            const y2 = currentPoint.netProfit;
            const x1 = prevPoint.salesPercent;
            const x2 = currentPoint.salesPercent;
            
            const interceptX = x1 - y1 * (x2 - x1) / (y2 - y1);
            
            const ratio = (interceptX - x1) / (x2 - x1);
            const interceptRevenue = prevPoint.revenue + (currentPoint.revenue - prevPoint.revenue) * ratio;
            const interceptTotalCost = prevPoint.totalCost + (currentPoint.totalCost - prevPoint.totalCost) * ratio;

            const interceptPoint = {
              ...prevPoint,
              salesPercent: interceptX,
              netProfit: 0,
              revenue: interceptRevenue,
              totalCost: interceptTotalCost,
            };
            processedData.push(transformPoint(interceptPoint));
          }
        }
        processedData.push(transformPoint(currentPoint));
      }

      setAnalysisData(processedData);
    };

    calculateAnalysisData();
  }, [inputs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
        return;
    }

    setInputs(prev => {
        const newInputs = { ...prev, [name]: value };

        const productionVolume = p(newInputs.productionVolume);

        let salesVolume: number;
        let inventoryVolume: number;

        if (name === 'productionVolume') {
            salesVolume = productionVolume;
            inventoryVolume = 0;
        } else if (name === 'salesVolume') {
            salesVolume = p(value);
            inventoryVolume = productionVolume - salesVolume;
        } else if (name === 'inventoryVolume') {
            inventoryVolume = p(value);
            salesVolume = productionVolume - inventoryVolume;
        } else if (name === 'salesVolumePercent') {
            let percent = p(value);
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;
            salesVolume = productionVolume * (percent / 100);
            inventoryVolume = productionVolume - salesVolume;
            newInputs.salesVolumePercent = String(percent);
        } else if (name === 'inventoryVolumePercent') {
            let percent = p(value);
            if (percent > 100) percent = 100;
            if (percent < 0) percent = 0;
            inventoryVolume = productionVolume * (percent / 100);
            salesVolume = productionVolume - inventoryVolume;
            newInputs.inventoryVolumePercent = String(percent);
        } else {
            return newInputs;
        }

        if (productionVolume > 0) {
            newInputs.salesVolume = String(salesVolume);
            newInputs.inventoryVolume = String(inventoryVolume);
            newInputs.salesVolumePercent = String((salesVolume / productionVolume) * 100);
            newInputs.inventoryVolumePercent = String((inventoryVolume / productionVolume) * 100);
        } else {
            newInputs.salesVolume = '0';
            newInputs.inventoryVolume = '0';
            newInputs.salesVolumePercent = '0';
            newInputs.inventoryVolumePercent = '0';
        }

        return newInputs;
    });
  };

  const handleVolumeModeChange = (mode: 'tons' | 'percent') => {
    if (mode) setVolumeMode(mode);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="text-center mb-8 relative">
        <h1 className="text-3xl font-bold tracking-tight">Steel Supply Chain Optimization Calculator</h1>
        <p className="text-muted-foreground">Adjust parameters to analyze costs, profit, and operational constraints.</p>
        <div className="absolute top-0 right-0">
          <SettingsSheet 
            hyperparameters={hyperparameters} 
            onUpdate={setHyperparameters}
            open={isSheetOpen}
            onOpenChange={setIsSheetOpen}
          >
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
          </SettingsSheet>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Input Parameters</CardTitle>
              <CardDescription>Adjust the core financial and environmental model assumptions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="sellingPrice">Selling Price per Ton (₹)</Label>
                <Input type="text" inputMode="decimal" id="sellingPrice" name="sellingPrice" value={inputs.sellingPrice} onChange={handleInputChange} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="manufacturingCostPerTon">Manufacturing Cost per Ton (₹)</Label>
                <Input type="text" inputMode="decimal" id="manufacturingCostPerTon" name="manufacturingCostPerTon" value={inputs.manufacturingCostPerTon} onChange={handleInputChange} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="storageCostPercent">Storage/Holding Cost (%)</Label>
                <Input type="text" inputMode="decimal" id="storageCostPercent" name="storageCostPercent" value={inputs.storageCostPercent} onChange={handleInputChange} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="transportationCostPercent">Transportation Cost (%)</Label>
                <Input type="text" inputMode="decimal" id="transportationCostPercent" name="transportationCostPercent" value={inputs.transportationCostPercent} onChange={handleInputChange} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="sustainabilityCostPerTonCO2">Sustainability Cost per CO₂ Ton (₹)</Label>
                <Input type="text" inputMode="decimal" id="sustainabilityCostPerTonCO2" name="sustainabilityCostPerTonCO2" value={inputs.sustainabilityCostPerTonCO2} onChange={handleInputChange} />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="co2EmissionFactor">CO₂ Emission Factor (CO₂/ton)</Label>
                <Input type="text" inputMode="decimal" id="co2EmissionFactor" name="co2EmissionFactor" value={inputs.co2EmissionFactor} onChange={handleInputChange} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational Inputs</CardTitle>
              <CardDescription>Enter the volumes you want to test or optimize.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="productionVolume">Production Volume (Tons)</Label>
                <Input type="text" inputMode="decimal" id="productionVolume" name="productionVolume" value={inputs.productionVolume} onChange={handleInputChange} />
              </div>
              
              <div className="grid w-full items-center gap-1.5">
                <div className="flex justify-between items-center mb-1">
                  <Label>Sales & Inventory</Label>
                  <ToggleGroup type="single" size="sm" value={volumeMode} onValueChange={handleVolumeModeChange} className="border rounded-md">
                    <ToggleGroupItem value="tons" aria-label="Set as tons">Tons</ToggleGroupItem>
                    <ToggleGroupItem value="percent" aria-label="Set as percentage">%</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {volumeMode === 'tons' ? (
                  <Input type="text" inputMode="decimal" id="salesVolume" name="salesVolume" value={inputs.salesVolume} onChange={handleInputChange} placeholder="Sales Volume (Tons)" />
                ) : (
                  <Input type="text" inputMode="decimal" id="salesVolumePercent" name="salesVolumePercent" value={inputs.salesVolumePercent} onChange={handleInputChange} placeholder="Sales Volume (%)" />
                )}
              </div>

              <div className="grid w-full items-center gap-1.5">
                {volumeMode === 'tons' ? (
                  <Input type="text" inputMode="decimal" id="inventoryVolume" name="inventoryVolume" value={inputs.inventoryVolume} onChange={handleInputChange} placeholder="Inventory Volume (Tons)" />
                ) : (
                  <Input type="text" inputMode="decimal" id="inventoryVolumePercent" name="inventoryVolumePercent" value={inputs.inventoryVolumePercent} onChange={handleInputChange} placeholder="Inventory Volume (%)" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>Calculated costs and profit based on your inputs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between font-semibold">
                    <span>Total Revenue</span>
                    <span>{formatCurrency(results.revenue)}</span>
                </div>
                <Separator />
                <div className="text-muted-foreground space-y-1 pt-1">
                    <div className="flex justify-between"><span>Manufacturing Cost</span><span>{formatCurrency(results.manufacturingCost)}</span></div>
                    <div className="flex justify-between"><span>Storage Cost</span><span>{formatCurrency(results.storageCost)}</span></div>
                    <div className="flex justify-between"><span>Transportation Cost</span><span>{formatCurrency(results.transportationCost)}</span></div>
                    <div className="flex justify-between"><span>Sustainability Cost</span><span>{formatCurrency(results.sustainabilityCost)}</span></div>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold pt-1">
                    <span>Total Cost</span>
                    <span>{formatCurrency(results.totalCost)}</span>
                </div>
                <Separator />
                <div className={`flex justify-between font-bold text-lg pt-1 ${results.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <span>Net Profit</span>
                    <span>{formatCurrency(results.netProfit)}</span>
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Constraints Checker</CardTitle>
              <CardDescription>Feasibility of the current operational inputs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  {constraints.production ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-red-500" />}
                  <span className={constraints.production ? "text-muted-foreground" : "text-red-500 font-semibold"}>Production Volume</span>
                </div>
                <div className={constraints.production ? "text-muted-foreground" : "text-red-500 font-semibold"}>
                  {formatNumber(p(inputs.productionVolume))} / {formatNumber(hyperparameters.maxProduction)} tons
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  {constraints.sales ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-red-500" />}
                  <span className={constraints.sales ? "text-muted-foreground" : "text-red-500 font-semibold"}>Sales Volume</span>
                </div>
                <div className={constraints.sales ? "text-muted-foreground" : "text-red-500 font-semibold"}>
                  {formatNumber(p(inputs.salesVolume))} / {formatNumber(hyperparameters.maxSales)} tons
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  {constraints.inventory ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-red-500" />}
                  <span className={constraints.inventory ? "text-muted-foreground" : "text-red-500 font-semibold"}>Inventory Space</span>
                </div>
                <div className={constraints.inventory ? "text-muted-foreground" : "text-red-500 font-semibold"}>
                  {formatNumber(p(inputs.inventoryVolume))} / {formatNumber(hyperparameters.maxInventory)} tons
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  {constraints.emissions ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> : <AlertCircle className="h-4 w-4 mr-2 text-red-500" />}
                  <span className={constraints.emissions ? "text-muted-foreground" : "text-red-500 font-semibold"}>Total CO₂ Emission</span>
                </div>
                <div className={constraints.emissions ? "text-muted-foreground" : "text-red-500 font-semibold"}>
                  {formatNumber(results.totalEmissions)} / {formatNumber(hyperparameters.maxEmissions)} tons CO₂
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Profitability Analysis</CardTitle>
            <CardDescription>
              Net profit, total cost, and revenue based on sales percentage (for current production volume).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={analysisData} margin={{ top: 5, right: 20, left: 50, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="salesPercent" 
                  unit="%"
                >
                  <RechartsLabel value="Sales Percentage (%)" position="insideBottom" offset={-15} />
                </XAxis>
                <YAxis 
                  tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(value)}
                >
                  <RechartsLabel value="Amount (INR)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} />
                <Line type="monotone" dataKey="netProfitPositive" name="Net Profit" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 6 }} connectNulls />
                <Line type="monotone" dataKey="netProfitNegative" name="Net Profit" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 6 }} connectNulls legendType="none" />
                <Line type="monotone" dataKey="totalCost" name="Total Cost" stroke="#f97316" strokeWidth={2} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Analysis Data</CardTitle>
            <CardDescription>
              Breakdown of financials and emissions at different sales percentages.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto relative">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Sales %</TableHead>
                    <TableHead>Production (tons)</TableHead>
                    <TableHead>Sales (tons)</TableHead>
                    <TableHead>Manufacturing Cost</TableHead>
                    <TableHead>Sustainable Cost</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Emissions (tons CO₂)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisData.map((data) => (
                    <TableRow key={data.salesPercent}>
                      <TableCell className="font-medium">{data.salesPercent.toFixed(2)}%</TableCell>
                      <TableCell>{formatNumber(data.productionVolume)}</TableCell>
                      <TableCell>{formatNumber(data.salesVolume)}</TableCell>
                      <TableCell>{formatCurrency(data.manufacturingCost)}</TableCell>
                      <TableCell>{formatCurrency(data.sustainabilityCost)}</TableCell>
                      <TableCell>{formatCurrency(data.totalCost)}</TableCell>
                      <TableCell>{formatCurrency(data.revenue)}</TableCell>
                      <TableCell className={data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(data.netProfit)}</TableCell>
                      <TableCell>{formatNumber(data.totalEmissions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}