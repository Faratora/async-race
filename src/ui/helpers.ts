import { element } from "./builder.ts";

type Attributes = Record<string, string | number | boolean | undefined>;

// ============ УТИЛИТЫ ============

export const escapeHtml = (text: string): string => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// ============ СОЗДАНИЕ ЭЛЕМЕНТОВ ============

export const createInput = (id: string, type: string, value: string, placeholder = "", width = 0): HTMLInputElement => {
  const inputClass = type === "color" ? "form-control form-control-color" : "form-control";
  const attributes: Attributes = { id, type, value, class: inputClass };
  if (placeholder) attributes.placeholder = placeholder;
  if (width > 0) attributes.style = `width: ${width}px;`;
  return element("input", attributes);
};

export const createButton = (id: string, text: string, buttonClass: string): HTMLElement =>
  element("button", { id, class: buttonClass }, text);

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
    element("button", {
      class: "btn btn-secondary",
      id: previousId,
      disabled: isPreviousDisabled ? true : undefined
    }, "Previous"),
    element("span", undefined, `Page ${currentPage} of ${totalPages}`),
    element("button", {
      class: "btn btn-secondary",
      id: nextId,
      disabled: isNextDisabled ? true : undefined
    }, "Next")
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
