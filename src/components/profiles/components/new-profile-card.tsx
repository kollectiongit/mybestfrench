import { Card, CardContent } from "@/components/ui/card";
import { PlusIcon } from "lucide-react";

export default function NewProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      className="h-96 w-full max-w-80 cursor-pointer border-dashed border-2 border-gray-300 hover:border-gray-400 ml-4 sm:ml-6 lg:ml-8"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center h-full p-6">
        <PlusIcon className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2 text-center">
          Créer un nouveau profil
        </h3>
      </CardContent>
    </Card>
  );
}
