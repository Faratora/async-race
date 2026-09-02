type Child = HTMLElement | string | number | boolean | undefined | Child[];
type Attributes = Record<string, string | number | boolean | undefined>;

function normalizeAttributeKey(key: string): string {
  if (key === "className") return "class";
  if (key === "htmlFor") return "for";
  if (key === "readOnly") return "readonly";
  if (key === "tabIndex") return "tabindex";
  if (key.startsWith("data") && key.length > 4 && key[4] >= "A" && key[4] <= "Z") {
    return key.replaceAll(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
  }
  return key;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Attributes,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      const normalizedKey = normalizeAttributeKey(key);
      if (value === true) {
        node.setAttribute(normalizedKey, "");
      } else if (value !== false && value !== undefined) {
        node.setAttribute(normalizedKey, String(value));
      }
    }
  }

  for (const child of children) {
    if (child === undefined || child === false) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.append(String(child));
    } else if (Array.isArray(child)) {
      for (const nested of child) {
        if (nested instanceof HTMLElement) {
          node.append(nested);
        } else if (typeof nested === "string" || typeof nested === "number") {
          node.append(String(nested));
        }
      }
    } else if (child instanceof HTMLElement) {
      node.append(child);
    }
  }

  return node;
}
