"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!bg-card !text-foreground !border-border !shadow-md font-sans",
          description: "!text-muted-foreground",
          success: "[&_svg]:!text-oro-profundo",
          error: "[&_svg]:!text-destructive",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
