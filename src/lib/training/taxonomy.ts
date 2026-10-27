import { prisma } from "@/lib/prisma";

export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "theme"
  );
}

async function uniqueSlug(name: string, exists: (slug: string) => Promise<boolean>) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await exists(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function uniqueCategorySlug(name: string) {
  return uniqueSlug(name, async (slug) => !!(await prisma.category.findUnique({ where: { slug } })));
}

export function uniqueTopicSlug(name: string) {
  return uniqueSlug(name, async (slug) => !!(await prisma.topic.findUnique({ where: { slug } })));
}
