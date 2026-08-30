import { element } from "./builder.ts";

type Attributes = Record<string, string | number | boolean | undefined>;

// ============ УТИЛИТЫ ============

export const getTotalPages = (total: number, perPage: number): number =>
  Math.ceil(total / perPage) || 1;

export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  let result = text;
  for (const [char, replacement] of Object.entries(map)) {
    result = result.split(char).join(replacement);
  }
  return result;
};

// ============ СОЗДАНИЕ ЭЛЕМЕНТОВ ============

export const createInput = (id: string, type: string, value: string, placeholder = "", width = 0): HTMLInputElement => {
  const inputClass = type === "color" ? "form-control form-control-color" : "form-control";
  const attributes: Attributes = { id, type, value, class: inputClass };
  if (placeholder) attributes.placeholder = placeholder;
  if (width > 0) attributes.style = `width: ${width}px;`;
  return element("input", attributes);
};

export const createButton = (
  id: string,
  text: string,
  buttonClass: string,
  attributes: Attributes = {},
): HTMLElement =>
  element("button", { id, class: buttonClass, ...attributes }, text);

export const createColorPalette = (selectedColor: string, onSelect: (color: string) => void): HTMLInputElement => {
  const input: HTMLInputElement = element("input", {
    type: "color",
    id: "car-color",
    class: "form-control form-control-color",
    value: selectedColor,
  });

  input.addEventListener("input", () => {
    onSelect(input.value);
  });

  return input;
};

// ============ ПАГИНАЦИЯ ============

export const createPagination = (
  previousId: string,
  nextId: string,
  currentPage: number,
  totalPages: number,
  isPreviousDisabled: boolean,
  isNextDisabled: boolean
): HTMLElement => {
  return element("div", { class: "pagination-controls" },
    createButton(previousId, "Previous", "btn btn-secondary", { disabled: isPreviousDisabled ? true : undefined }),
    element("span", undefined, `Page ${currentPage} of ${totalPages}`),
    createButton(nextId, "Next", "btn btn-secondary", { disabled: isNextDisabled ? true : undefined })
  );
};

// ============ ЗАГОЛОВОК СТРАНИЦЫ ============

export const renderHeader = (
  container: HTMLElement | DocumentFragment,
  title: string,
  total: number,
  currentPage: number,
  totalPages: number
): void => {
  container.append(
    element("div", { class: "view-header" },
      element("span", { class: "view-title" }, title),
      element("span", { class: "view-info" },
        `Page ${currentPage} of ${totalPages} · ${total} total`
      )
    )
  );
};

// ============ СБРОС ВИЗУАЛА МАШИНЫ ============

export const resetCarVisualReset = (car: HTMLElement, shouldRemoveLastPosition = false): void => {
  for (const className of car.classList) {
    if (className.startsWith("broken-")) {
      car.classList.remove(className);
    }
  }
  car.classList.remove("broken");
  car.style.opacity = "1";
  car.style.scale = "1";
  car.style.rotate = "0deg";
  car.style.transform = "translateX(0px)";
  if (shouldRemoveLastPosition) {
    delete car.dataset.lastPosition;
  }
};
