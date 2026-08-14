import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type DetailField = { label: string; value: unknown };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: DetailField[];
  raw?: unknown;
}

const render = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
};

export default function RecordDetailDialog({ open, onOpenChange, title, description, fields, raw }: Props) {
  const { toast } = useToast();

  const copyAll = async () => {
    const text = raw
      ? JSON.stringify(raw, null, 2)
      : fields.map((f) => `${f.label}: ${render(f.value)}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Record details copied to clipboard." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-md border border-border p-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
              <pre className="mt-0.5 whitespace-pre-wrap break-all font-sans text-xs">{render(f.value)}</pre>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={copyAll}>
          <Copy className="mr-1 h-4 w-4" /> Copy details
        </Button>
      </DialogContent>
    </Dialog>
  );
}
