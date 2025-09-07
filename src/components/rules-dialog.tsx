"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LightbulbIcon } from "lucide-react";
import * as React from "react";
import Markdown from "react-markdown";

interface RulesDialogProps {
  rulesExplanationMessage: string | null;
}

export function RulesDialog({ rulesExplanationMessage }: RulesDialogProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Don't render the button if there are no rules
  if (!rulesExplanationMessage) {
    return null;
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <LightbulbIcon className="h-4 w-4" />
            Voir les règles
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Règles de la dictée</DialogTitle>
            <DialogDescription>
              Consultez les règles et explications pour cette dictée.
            </DialogDescription>
          </DialogHeader>
          <div className="rules-markdown">
            <Markdown>{rulesExplanationMessage}</Markdown>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LightbulbIcon className="h-4 w-4" />
          Voir les règles
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Règles de la dictée</DrawerTitle>
          <DrawerDescription>
            Consultez les règles et explications pour cette dictée.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
          <div className="rules-markdown">
            <Markdown>{rulesExplanationMessage}</Markdown>
          </div>
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Fermer</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
