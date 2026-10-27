"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** "Supprimer" button that asks for confirmation, then calls the DELETE endpoint. */
export function DeleteButton({
  url,
  label,
  title,
  description,
  onDeleted,
}: {
  url: string;
  label: string;
  title: string;
  description: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "La suppression a échoué");
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La suppression a échoué");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
