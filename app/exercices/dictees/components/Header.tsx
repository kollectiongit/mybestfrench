interface HeaderProps {
  count: number;
}

export default function Header({ count }: HeaderProps) {
  return (
    <h1 className="text-3xl font-bold text-gray-900">
      {count} {count === 1 ? "dictée" : "dictées"}
    </h1>
  );
}
