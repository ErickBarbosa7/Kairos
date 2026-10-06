const date = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" });
export const formatDate = (iso: string) => date.format(new Date(iso));
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
