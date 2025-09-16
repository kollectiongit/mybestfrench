interface HeaderProps {
  count: number;
}

export default function Header({ count }: HeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {count} {count === 1 ? "dictée" : "dictées"}
      </h1>
      <p className="text-gray-600">Choisis une dictée pour t&apos;entrainer</p>
    </div>
  );
}
