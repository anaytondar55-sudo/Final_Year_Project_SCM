"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, Settings, Plus, Trash2, Edit2, Variable, FunctionSquare, Info, MinusCircle } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SettingsSheet } from "./SettingsSheet";
import { SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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
import { evaluate } from "mathjs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomParameter {
  id: string;
  name: string;       // camelCase variable name used in formulas
  label: string;      // Display label
  value: string;
  unit: string;
  description: string;
}

interface CustomFormula {
  id: string;
  name: string;       // Result label
  expression: string; // Math expression referencing parameter names
  unit: string;
  description: string;
  subtractFromProfit: boolean; // If true, this formula's result is subtracted from Net Profit
}

interface FormulaResult {
  id: string;
  name: string;
  value: number | null;
  error: string | null;
  unit: string;
  subtractFromProfit: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const generateId = () => crypto.randomUUID();

// ─── Default custom formulas shipped with the calculator ─────────────────────

const DEFAULT_FORMULAS: CustomFormula[] = [
  {
    id: 'f-revenue',
    name: 'Revenue',
    expression: 'sellingPrice * salesVolume',
    unit: '₹',
    description: 'Total revenue from sales',
    subtractFromProfit: false,
  },
  {
    id: 'f-mfg',
    name: 'Manufacturing Cost',
    expression: 'manufacturingCostPerTon * productionVolume',
    unit: '₹',
    description: 'Total manufacturing cost',
    subtractFromProfit: false,
  },
  {
    id: 'f-storage',
    name: 'Storage Cost',
    expression: 'sellingPrice * (storageCostPercent / 100) * inventoryVolume',
    unit: '₹',
    description: 'Holding / storage cost',
    subtractFromProfit: false,
  },
  {
    id: 'f-transport',
    name: 'Transportation Cost',
    expression: 'sellingPrice * (transportationCostPercent / 100) * productionVolume',
    unit: '₹',
    description: 'Transportation cost',
    subtractFromProfit: false,
  },
  {
    id: 'f-emissions',
    name: 'Total Emissions',
    expression: 'co2EmissionFactor * productionVolume',
    unit: 'tons CO₂',
    description: 'Total CO₂ emissions',
    subtractFromProfit: false,
  },
  {
    id: 'f-sustain',
    name: 'Sustainability Cost',
    expression: 'sustainabilityCostPerTonCO2 * co2EmissionFactor * productionVolume',
    unit: '₹',
    description: 'Carbon offset cost',
    subtractFromProfit: false,
  },
  {
    id: 'f-totalcost',
    name: 'Total Cost',
    expression:
      '(manufacturingCostPerTon * productionVolume) + (sellingPrice * (storageCostPercent / 100) * inventoryVolume) + (sellingPrice * (transportationCostPercent / 100) * productionVolume) + (sustainabilityCostPerTonCO2 * co2EmissionFactor * productionVolume)',
    unit: '₹',
    description: 'Sum of all costs',
    subtractFromProfit: false,
  },
  {
    id: 'f-profit',
    name: 'Net Profit',
    expression:
      '(sellingPrice * salesVolume) - ((manufacturingCostPerTon * productionVolume) + (sellingPrice * (storageCostPercent / 100) * inventoryVolume) + (sellingPrice * (transportationCostPercent / 100) * productionVolume) + (sustainabilityCostPerTonCO2 * co2EmissionFactor * productionVolume))',
    unit: '₹',
    description: 'Revenue minus total cost',
    subtractFromProfit: false,
  },
];

// ─── Built-in parameter definitions (so we can display them in the variable reference) ─

const BUILTIN_PARAMS: { name: string; label: string; unit: string }[] = [
  { name: 'sellingPrice', label: 'Selling Price per Ton', unit: '₹' },
  { name: 'manufacturingCostPerTon', label: 'Manufacturing Cost per Ton', unit: '₹' },
  { name: 'storageCostPercent', label: 'Storage/Holding Cost', unit: '%' },
  { name: 'transportationCostPercent', label: 'Transportation Cost', unit: '%' },
  { name: 'sustainabilityCostPerTonCO2', label: 'Sustainability Cost per CO₂ Ton', unit: '₹' },
  { name: 'co2EmissionFactor', label: 'CO₂ Emission Factor', unit: 'CO₂/ton' },
  { name: 'productionVolume', label: 'Production Volume', unit: 'Tons' },
  { name: 'salesVolume', label: 'Sales Volume', unit: 'Tons' },
  { name: 'inventoryVolume', label: 'Inventory Volume', unit: 'Tons' },
];

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export function SupplyChainCalculator() {
  // ── Built-in inputs ────────────────────────────────────────────────────────
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

  // ── Dynamic custom parameters ──────────────────────────────────────────────
  const [customParams, setCustomParams] = useState<CustomParameter[]>([]);
  const [paramDialogOpen, setParamDialogOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<CustomParameter | null>(null);
  const [paramForm, setParamForm] = useState<Omit<CustomParameter, 'id'>>({
    name: '',
    label: '',
    value: '0',
    unit: '',
    description: '',
  });

  // ── Dynamic custom formulas ────────────────────────────────────────────────
  const [customFormulas, setCustomFormulas] = useState<CustomFormula[]>(DEFAULT_FORMULAS);
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<CustomFormula | null>(null);
  const [formulaForm, setFormulaForm] = useState<Omit<CustomFormula, 'id'>>({
    name: '',
    expression: '',
    unit: '',
    description: '',
    subtractFromProfit: true,
  });
  const [formulaPreview, setFormulaPreview] = useState<string>('');

  // ── Derived: evaluation context ────────────────────────────────────────────
  const p = (v: string) => parseFloat(v) || 0;

  const evalContext = useMemo(() => {
    const ctx: Record<string, number> = {
      sellingPrice: p(inputs.sellingPrice),
      manufacturingCostPerTon: p(inputs.manufacturingCostPerTon),
      storageCostPercent: p(inputs.storageCostPercent),
      transportationCostPercent: p(inputs.transportationCostPercent),
      sustainabilityCostPerTonCO2: p(inputs.sustainabilityCostPerTonCO2),
      co2EmissionFactor: p(inputs.co2EmissionFactor),
      productionVolume: p(inputs.productionVolume),
      salesVolume: p(inputs.salesVolume),
      inventoryVolume: p(inputs.inventoryVolume),
    };
    customParams.forEach((cp) => {
      ctx[cp.name] = p(cp.value);
    });
    return ctx;
  }, [inputs, customParams]);

  // ── Evaluate a single formula safely ───────────────────────────────────────
  const safeEvaluate = useCallback(
    (expression: string, ctx: Record<string, number>): { value: number | null; error: string | null } => {
      try {
        const result = evaluate(expression, ctx);
        if (typeof result === 'number' && isFinite(result)) {
          return { value: result, error: null };
        }
        return { value: null, error: 'Result is not a finite number' };
      } catch (err: any) {
        return { value: null, error: err.message ?? 'Evaluation error' };
      }
    },
    [],
  );

  // ── Compute formula results ────────────────────────────────────────────────
  const formulaResults: FormulaResult[] = useMemo(() => {
    return customFormulas.map((f) => {
      const { value, error } = safeEvaluate(f.expression, evalContext);
      return { id: f.id, name: f.name, value, error, unit: f.unit, subtractFromProfit: f.subtractFromProfit };
    });
  }, [customFormulas, evalContext, safeEvaluate]);

  // ── Sum of user-added formulas marked "subtract from profit" ───────────────
  const userFormulaDeductions = useMemo(() => {
    return formulaResults
      .filter((r) => r.subtractFromProfit && r.value != null)
      .reduce((sum, r) => sum + (r.value ?? 0), 0);
  }, [formulaResults]);

  // ── Legacy results (for backwards compat with chart & table) ───────────────
  const results = useMemo(() => {
    const findVal = (id: string) => formulaResults.find((r) => r.id === id)?.value ?? 0;
    return {
      revenue: findVal('f-revenue'),
      manufacturingCost: findVal('f-mfg'),
      storageCost: findVal('f-storage'),
      transportationCost: findVal('f-transport'),
      totalEmissions: findVal('f-emissions'),
      sustainabilityCost: findVal('f-sustain'),
      totalCost: findVal('f-totalcost') + userFormulaDeductions,
      netProfit: findVal('f-profit') - userFormulaDeductions,
    };
  }, [formulaResults, userFormulaDeductions]);

  // ── Constraints ────────────────────────────────────────────────────────────
  const constraints = useMemo(() => ({
    inventory: p(inputs.inventoryVolume) <= hyperparameters.maxInventory,
    production: p(inputs.productionVolume) <= hyperparameters.maxProduction,
    sales: p(inputs.salesVolume) <= hyperparameters.maxSales,
    emissions: results.totalEmissions <= hyperparameters.maxEmissions,
  }), [inputs, hyperparameters, results.totalEmissions]);

  // ── Analysis chart data ────────────────────────────────────────────────────
  const [analysisData, setAnalysisData] = useState<any[]>([]);

  useEffect(() => {
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

    // Build a per-salesPercent evaluation context including custom params
    const customCtx: Record<string, number> = {};
    customParams.forEach((cp) => { customCtx[cp.name] = p(cp.value); });

    const rawData = [];

    for (let salesPercent = 65; salesPercent <= 100; salesPercent += 1) {
      const sv = productionVolume * (salesPercent / 100);
      const iv = productionVolume - sv;

      // Build context for this data point
      const pointCtx: Record<string, number> = {
        sellingPrice,
        manufacturingCostPerTon,
        storageCostPercent,
        transportationCostPercent,
        sustainabilityCostPerTonCO2,
        co2EmissionFactor,
        productionVolume,
        salesVolume: sv,
        inventoryVolume: iv,
        ...customCtx,
      };

      // Evaluate all formulas for this point
      const revenueVal = safeEvaluate('sellingPrice * salesVolume', pointCtx).value ?? 0;

      // Use the actual formula expressions for totalCost and netProfit
      const totalCostFormula = customFormulas.find(f => f.id === 'f-totalcost');
      const netProfitFormula = customFormulas.find(f => f.id === 'f-profit');
      const mfgFormula = customFormulas.find(f => f.id === 'f-mfg');
      const sustainFormula = customFormulas.find(f => f.id === 'f-sustain');
      const emissionsFormula = customFormulas.find(f => f.id === 'f-emissions');

      const manufacturingCost = mfgFormula ? (safeEvaluate(mfgFormula.expression, pointCtx).value ?? 0) : 0;
      const sustainabilityCost = sustainFormula ? (safeEvaluate(sustainFormula.expression, pointCtx).value ?? 0) : 0;
      let totalCost = totalCostFormula ? (safeEvaluate(totalCostFormula.expression, pointCtx).value ?? 0) : 0;
      let netProfit = netProfitFormula ? (safeEvaluate(netProfitFormula.expression, pointCtx).value ?? 0) : 0;
      const totalEmissions = emissionsFormula ? (safeEvaluate(emissionsFormula.expression, pointCtx).value ?? 0) : 0;

      // Subtract user-added formulas marked "subtract from profit"
      const userAddedFormulas = customFormulas.filter(f => f.subtractFromProfit);
      let chartDeductions = 0;
      for (const uf of userAddedFormulas) {
        const ufVal = safeEvaluate(uf.expression, pointCtx).value ?? 0;
        chartDeductions += ufVal;
      }
      totalCost += chartDeductions;
      netProfit -= chartDeductions;

      rawData.push({
        salesPercent,
        productionVolume,
        salesVolume: sv,
        manufacturingCost,
        sustainabilityCost,
        totalCost,
        revenue: revenueVal,
        netProfit,
        totalEmissions,
      });
    }

    const processedData: any[] = [];
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
          processedData.push(
            transformPoint({
              ...prevPoint,
              salesPercent: interceptX,
              netProfit: 0,
              revenue: interceptRevenue,
              totalCost: interceptTotalCost,
            }),
          );
        }
      }
      processedData.push(transformPoint(currentPoint));
    }

    setAnalysisData(processedData);
  }, [inputs, customParams, customFormulas, safeEvaluate]);

  // ── Input change handler (built-in params) ─────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;

    setInputs(prev => {
      const newInputs = { ...prev, [name]: value };
      const productionVolume = p(newInputs.productionVolume);
      let salesVolume = p(newInputs.salesVolume);
      let inventoryVolume = p(newInputs.inventoryVolume);

      if (name === 'productionVolume') {
        const salesPercent = p(newInputs.salesVolumePercent);
        salesVolume = productionVolume * (salesPercent / 100);
        inventoryVolume = productionVolume - salesVolume;
      } else if (name === 'salesVolume') {
        inventoryVolume = productionVolume - salesVolume;
      } else if (name === 'inventoryVolume') {
        salesVolume = productionVolume - inventoryVolume;
      } else if (name === 'salesVolumePercent') {
        let percent = p(value);
        if (percent > 100) { percent = 100; newInputs.salesVolumePercent = '100'; }
        salesVolume = productionVolume * (percent / 100);
        inventoryVolume = productionVolume - salesVolume;
      } else if (name === 'inventoryVolumePercent') {
        let percent = p(value);
        if (percent > 100) { percent = 100; newInputs.inventoryVolumePercent = '100'; }
        inventoryVolume = productionVolume * (percent / 100);
        salesVolume = productionVolume - inventoryVolume;
      } else {
        return newInputs;
      }

      if (productionVolume > 0) {
        if (name !== 'salesVolume') newInputs.salesVolume = String(salesVolume);
        if (name !== 'inventoryVolume') newInputs.inventoryVolume = String(inventoryVolume);
        if (name !== 'salesVolumePercent')
          newInputs.salesVolumePercent = String(parseFloat(((salesVolume / productionVolume) * 100).toFixed(2)));
        if (name !== 'inventoryVolumePercent')
          newInputs.inventoryVolumePercent = String(parseFloat(((inventoryVolume / productionVolume) * 100).toFixed(2)));
      } else {
        if (name !== 'salesVolume') newInputs.salesVolume = '0';
        if (name !== 'inventoryVolume') newInputs.inventoryVolume = '0';
        if (name !== 'salesVolumePercent') newInputs.salesVolumePercent = '0';
        if (name !== 'inventoryVolumePercent') newInputs.inventoryVolumePercent = '0';
      }
      return newInputs;
    });
  };

  const handleVolumeModeChange = (mode: 'tons' | 'percent') => {
    if (mode) setVolumeMode(mode);
  };

  // ── Custom parameter handlers ──────────────────────────────────────────────
  const openAddParam = () => {
    setEditingParam(null);
    setParamForm({ name: '', label: '', value: '0', unit: '', description: '' });
    setParamDialogOpen(true);
  };

  const openEditParam = (param: CustomParameter) => {
    setEditingParam(param);
    setParamForm({ name: param.name, label: param.label, value: param.value, unit: param.unit, description: param.description });
    setParamDialogOpen(true);
  };

  const saveParam = () => {
    const sanitizedName = paramForm.name.replace(/[^a-zA-Z0-9_]/g, '');
    if (!sanitizedName || !paramForm.label) return;

    if (editingParam) {
      setCustomParams(prev => prev.map(cp =>
        cp.id === editingParam.id ? { ...cp, ...paramForm, name: sanitizedName } : cp
      ));
    } else {
      setCustomParams(prev => [...prev, { ...paramForm, name: sanitizedName, id: generateId() }]);
    }
    setParamDialogOpen(false);
  };

  const deleteParam = (id: string) => {
    setCustomParams(prev => prev.filter(cp => cp.id !== id));
  };

  const handleCustomParamValueChange = (id: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setCustomParams(prev => prev.map(cp => (cp.id === id ? { ...cp, value } : cp)));
  };

  // ── Custom formula handlers ────────────────────────────────────────────────
  const openAddFormula = () => {
    setEditingFormula(null);
    setFormulaForm({ name: '', expression: '', unit: '', description: '', subtractFromProfit: true });
    setFormulaPreview('');
    setFormulaDialogOpen(true);
  };

  const openEditFormula = (formula: CustomFormula) => {
    setEditingFormula(formula);
    setFormulaForm({ name: formula.name, expression: formula.expression, unit: formula.unit, description: formula.description, subtractFromProfit: formula.subtractFromProfit });
    const { value, error } = safeEvaluate(formula.expression, evalContext);
    setFormulaPreview(error ? `Error: ${error}` : `= ${formatNumber(value!)}`);
    setFormulaDialogOpen(true);
  };

  const saveFormula = () => {
    if (!formulaForm.name || !formulaForm.expression) return;

    if (editingFormula) {
      setCustomFormulas(prev => prev.map(f =>
        f.id === editingFormula.id ? { ...f, ...formulaForm } : f,
      ));
    } else {
      setCustomFormulas(prev => [...prev, { ...formulaForm, id: generateId() }]);
    }
    setFormulaDialogOpen(false);
  };

  const deleteFormula = (id: string) => {
    setCustomFormulas(prev => prev.filter(f => f.id !== id));
  };

  // Live formula preview
  const handleFormulaExpressionChange = (expr: string) => {
    setFormulaForm(prev => ({ ...prev, expression: expr }));
    if (!expr.trim()) { setFormulaPreview(''); return; }
    const { value, error } = safeEvaluate(expr, evalContext);
    setFormulaPreview(error ? `Error: ${error}` : `= ${formatNumber(value!)}`);
  };

  // ── Is a formula result a currency? ────────────────────────────────────────
  const formatResult = (r: FormulaResult) => {
    if (r.error) return r.error;
    if (r.value == null) return '—';
    if (r.unit === '₹') return formatCurrency(r.value);
    return `${formatNumber(r.value)} ${r.unit}`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
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

        {/* ── Top grid: inputs + results ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Built-in Input Parameters ──────────────────────────────── */}
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

            {/* ── Operational Inputs ─────────────────────────────────────── */}
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

                <div className="grid w-full items-center">
                  <div className="flex justify-between items-center">
                    <Label>Sales</Label>
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

                <div>
                  <Label>Inventory</Label>
                  <div className="grid w-full items-center gap-1.5">
                    {volumeMode === 'tons' ? (
                      <Input type="text" inputMode="decimal" id="inventoryVolume" name="inventoryVolume" value={inputs.inventoryVolume} onChange={handleInputChange} placeholder="Inventory Volume (Tons)" />
                    ) : (
                      <Input type="text" inputMode="decimal" id="inventoryVolumePercent" name="inventoryVolumePercent" value={inputs.inventoryVolumePercent} onChange={handleInputChange} placeholder="Inventory Volume (%)" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Custom Parameters Card ─────────────────────────────────── */}
            <Card className="md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Variable className="h-5 w-5" />
                    Custom Parameters
                  </CardTitle>
                  <CardDescription>Add your own input variables to use in formulas.</CardDescription>
                </div>
                <Button size="sm" onClick={openAddParam}>
                  <Plus className="h-4 w-4 mr-1" /> Add Parameter
                </Button>
              </CardHeader>
              <CardContent>
                {customParams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No custom parameters yet. Click &quot;Add Parameter&quot; to create one.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customParams.map((cp) => (
                      <div key={cp.id} className="flex items-end gap-2 rounded-lg border p-3">
                        <div className="flex-1 grid gap-1.5">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`cp-${cp.id}`} className="text-sm font-medium">
                              {cp.label}
                              {cp.unit && <span className="text-muted-foreground ml-1">({cp.unit})</span>}
                            </Label>
                            {cp.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>{cp.description}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs font-mono">{cp.name}</Badge>
                          </div>
                          <Input
                            type="text"
                            inputMode="decimal"
                            id={`cp-${cp.id}`}
                            value={cp.value}
                            onChange={(e) => handleCustomParamValueChange(cp.id, e.target.value)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditParam(cp)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteParam(cp.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right column: Results + Constraints ──────────────────────── */}
          <div className="lg:col-span-1 space-y-6">

            {/* ── Formula Results ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FunctionSquare className="h-5 w-5" />
                    Results
                  </CardTitle>
                  <CardDescription>Calculated from your formulas below.</CardDescription>
                </div>
                <Button size="sm" onClick={openAddFormula}>
                  <Plus className="h-4 w-4 mr-1" /> Add Formula
                </Button>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {formulaResults.map((r, i) => {
                  // For Net Profit and Total Cost, use the adjusted values from `results` (includes user-formula deductions)
                  const displayValue = r.id === 'f-profit' ? results.netProfit
                    : r.id === 'f-totalcost' ? results.totalCost
                      : r.value;
                  const adjustedResult = { ...r, value: displayValue };

                  return (
                    <div key={r.id}>
                      <div className={`flex justify-between items-center py-1 ${r.error ? 'text-red-500' :
                          r.id === 'f-profit' ? (results.netProfit >= 0 ? 'text-green-600 font-bold text-lg' : 'text-red-600 font-bold text-lg') :
                            r.id === 'f-totalcost' || r.id === 'f-revenue' ? 'font-semibold' :
                              'text-muted-foreground'
                        }`}>
                        <div className="flex items-center gap-1.5">
                          {r.subtractFromProfit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <MinusCircle className="h-3.5 w-3.5 text-orange-500" />
                              </TooltipTrigger>
                              <TooltipContent>Subtracted from Net Profit</TooltipContent>
                            </Tooltip>
                          )}
                          <span>{r.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => openEditFormula(customFormulas.find(f => f.id === r.id)!)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit formula</TooltipContent>
                          </Tooltip>
                        </div>
                        <span>{formatResult(adjustedResult)}</span>
                      </div>
                      {(r.id === 'f-revenue' || r.id === 'f-totalcost') && <Separator />}
                      {i < formulaResults.length - 1 && r.id !== 'f-revenue' && r.id !== 'f-totalcost' && (
                        <div className="h-px" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ── Constraints ─────────────────────────────────────────────── */}
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

        {/* ── Chart + Table ──────────────────────────────────────────────── */}
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
                  <XAxis dataKey="salesPercent" unit="%">
                    <RechartsLabel value="Sales Percentage (%)" position="insideBottom" offset={-15} />
                  </XAxis>
                  <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(value)}>
                    <RechartsLabel value="Amount (INR)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                  </YAxis>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
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

        {/* ═══ DIALOGS ═══════════════════════════════════════════════════════ */}

        {/* ── Add/Edit Parameter Dialog ────────────────────────────────────── */}
        <Dialog open={paramDialogOpen} onOpenChange={setParamDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingParam ? 'Edit Parameter' : 'Add Custom Parameter'}</DialogTitle>
              <DialogDescription>
                Define a new variable that can be referenced in formulas by its variable name.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="paramLabel">Display Label *</Label>
                <Input
                  id="paramLabel"
                  placeholder="e.g. Discount Rate"
                  value={paramForm.label}
                  onChange={(e) => setParamForm(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="paramName">Variable Name *</Label>
                <Input
                  id="paramName"
                  placeholder="e.g. discountRate"
                  className="font-mono"
                  value={paramForm.name}
                  onChange={(e) => setParamForm(prev => ({ ...prev, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                />
                <p className="text-xs text-muted-foreground">Letters, numbers, underscores only. This is the name you use in formulas.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="paramValue">Default Value</Label>
                  <Input
                    id="paramValue"
                    type="text"
                    inputMode="decimal"
                    value={paramForm.value}
                    onChange={(e) => setParamForm(prev => ({ ...prev, value: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="paramUnit">Unit</Label>
                  <Input
                    id="paramUnit"
                    placeholder="e.g. %, ₹, tons"
                    value={paramForm.unit}
                    onChange={(e) => setParamForm(prev => ({ ...prev, unit: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="paramDesc">Description (optional)</Label>
                <Input
                  id="paramDesc"
                  placeholder="What does this parameter represent?"
                  value={paramForm.description}
                  onChange={(e) => setParamForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={saveParam} disabled={!paramForm.name || !paramForm.label}>
                {editingParam ? 'Save Changes' : 'Add Parameter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add/Edit Formula Dialog ─────────────────────────────────────── */}
        <Dialog open={formulaDialogOpen} onOpenChange={setFormulaDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingFormula ? 'Edit Formula' : 'Add Custom Formula'}</DialogTitle>
              <DialogDescription>
                Write a mathematical expression using parameter variable names.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="formulaName">Formula Name *</Label>
                <Input
                  id="formulaName"
                  placeholder="e.g. Discounted Revenue"
                  value={formulaForm.name}
                  onChange={(e) => setFormulaForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="formulaExpr">Expression *</Label>
                <Input
                  id="formulaExpr"
                  className="font-mono"
                  placeholder="e.g. sellingPrice * salesVolume * (1 - discountRate / 100)"
                  value={formulaForm.expression}
                  onChange={(e) => handleFormulaExpressionChange(e.target.value)}
                />
                {formulaPreview && (
                  <p className={`text-sm font-mono ${formulaPreview.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                    {formulaPreview}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="formulaUnit">Unit</Label>
                  <Input
                    id="formulaUnit"
                    placeholder="e.g. ₹, tons"
                    value={formulaForm.unit}
                    onChange={(e) => setFormulaForm(prev => ({ ...prev, unit: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="formulaDesc">Description</Label>
                  <Input
                    id="formulaDesc"
                    placeholder="What does this calculate?"
                    value={formulaForm.description}
                    onChange={(e) => setFormulaForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Variable reference */}
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Available Variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUILTIN_PARAMS.map((bp) => (
                    <Tooltip key={bp.name}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => handleFormulaExpressionChange(formulaForm.expression + bp.name)}
                        >
                          {bp.name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{bp.label} ({bp.unit})</TooltipContent>
                    </Tooltip>
                  ))}
                  {customParams.map((cp) => (
                    <Tooltip key={cp.id}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="default"
                          className="font-mono text-xs cursor-pointer"
                          onClick={() => handleFormulaExpressionChange(formulaForm.expression + cp.name)}
                        >
                          {cp.name}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{cp.label} ({cp.unit}) — Custom</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Subtract from profit toggle */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id="subtractFromProfit"
                  checked={formulaForm.subtractFromProfit}
                  onCheckedChange={(checked) => setFormulaForm(prev => ({ ...prev, subtractFromProfit: !!checked }))}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor="subtractFromProfit" className="text-sm font-medium cursor-pointer">
                    Subtract from Net Profit
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, this formula&apos;s result will be deducted from the final Net Profit.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex justify-between sm:justify-between">
              <div>
                {editingFormula && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteFormula(editingFormula.id);
                      setFormulaDialogOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={saveFormula} disabled={!formulaForm.name || !formulaForm.expression}>
                  {editingFormula ? 'Save Changes' : 'Add Formula'}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}