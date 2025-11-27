"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

interface Hyperparameters {
  maxInventory: number;
  maxProduction: number;
  maxSales: number;
  maxEmissions: number;
}

interface SettingsSheetProps {
  hyperparameters: Hyperparameters;
  onUpdate: (newParams: Hyperparameters) => void;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ hyperparameters, onUpdate, children, open, onOpenChange }: SettingsSheetProps) {
  const [localParams, setLocalParams] = useState(hyperparameters);

  useEffect(() => {
    setLocalParams(hyperparameters);
  }, [hyperparameters, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalParams(prev => ({
      ...prev,
      [name]: value === '' ? 0 : parseFloat(value),
    }));
  };

  const handleSave = () => {
    onUpdate(localParams);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Update Hyperparameters</SheetTitle>
          <SheetDescription>
            Adjust the operational constraints for the simulation.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxProduction" className="text-right col-span-2">
              Production Capacity (tons)
            </Label>
            <Input
              id="maxProduction"
              name="maxProduction"
              type="number"
              value={localParams.maxProduction}
              onChange={handleInputChange}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxSales" className="text-right col-span-2">
              Max Sales Volume (tons)
            </Label>
            <Input
              id="maxSales"
              name="maxSales"
              type="number"
              value={localParams.maxSales}
              onChange={handleInputChange}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxInventory" className="text-right col-span-2">
              Inventory Space (tons)
            </Label>
            <Input
              id="maxInventory"
              name="maxInventory"
              type="number"
              value={localParams.maxInventory}
              onChange={handleInputChange}
              className="col-span-2"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxEmissions" className="text-right col-span-2">
              CO₂ Emission Limit (tons)
            </Label>
            <Input
              id="maxEmissions"
              name="maxEmissions"
              type="number"
              value={localParams.maxEmissions}
              onChange={handleInputChange}
              className="col-span-2"
            />
          </div>
        </div>
        <SheetFooter>
          <Button type="submit" onClick={handleSave}>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}