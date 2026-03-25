"use client";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type DateRange = { from?: Date; to?: Date };

type Props = {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  label: string;
};

export default function DashboardDateRange({ range, onRangeChange, label }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" suppressHydrationWarning>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          mode="range"
          selected={range as any}
          onSelect={(value) => {
            if (value) onRangeChange(value as DateRange);
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
