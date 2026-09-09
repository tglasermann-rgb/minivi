"use client";
import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CalendarProps = DayPickerProps & { className?: string };

/** Calendario (react-day-picker v10) en español. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-4",
        month_caption: "flex h-8 items-center justify-center relative",
        caption_label: "text-sm font-medium capitalize",
        nav: "absolute inset-x-3 flex items-center justify-between h-8 z-10",
        button_previous: cn(buttonVariants({ variant: "outline" }), "size-7 bg-transparent p-0 opacity-60 hover:opacity-100"),
        button_next: cn(buttonVariants({ variant: "outline" }), "size-7 bg-transparent p-0 opacity-60 hover:opacity-100"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-8 text-[0.8rem] font-normal capitalize",
        week: "flex w-full mt-1",
        day: "relative size-8 p-0 text-center text-sm",
        day_button: cn(buttonVariants({ variant: "ghost" }), "size-8 p-0 font-normal aria-selected:opacity-100"),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
        today: "[&>button]:text-oro-profundo [&>button]:font-semibold",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "[&>button]:bg-accent [&>button]:rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? <ChevronLeftIcon className="size-4" {...rest} /> : <ChevronRightIcon className="size-4" {...rest} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
