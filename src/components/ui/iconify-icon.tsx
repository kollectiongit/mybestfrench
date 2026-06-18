"use client";

import { Icon } from "@iconify/react";

/**
 * Petit wrapper autour d'Iconify.
 * Rend l'icône dont le nom est fourni (ex. "mdi:book-open").
 * Si le nom est vide/invalide, on ne rend rien (fallback silencieux).
 */
export function IconifyIcon({
  name,
  className,
  width = 20,
  height = 20,
}: {
  name?: string | null;
  className?: string;
  width?: number;
  height?: number;
}) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  return (
    <Icon icon={trimmed} className={className} width={width} height={height} />
  );
}

export default IconifyIcon;
