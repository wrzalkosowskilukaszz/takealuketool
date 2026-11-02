import { SubNav } from "@/components/ui";

export function CvNav() {
  return (
    <SubNav
      items={[
        { href: "/cv", label: "New CV" },
        { href: "/cv/versions", label: "Versions" },
        { href: "/cv/base", label: "Experience base" },
      ]}
    />
  );
}
