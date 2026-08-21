import { element } from "./builder.ts";

type Attributes = Record<string, string | number | boolean | undefined>;

// ============ УТИЛИТЫ ============

export const escapeHtml = (text: string): string => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

// ============ СОЗДАНИЕ ЭЛЕМЕНТОВ ============

export const createInput = (id: string, type: string, value: string, placeholder = "", width = 0): HTMLElement => {
  const inputClass = type === "color" ? "form-control form-control-color" : "form-control";
  const attrs: Attributes = { id, type, value, class: inputClass };
  if (placeholder) attrs.placeholder = placeholder;
  if (width > 0) attrs.style = `width: ${width}px;`;
  return element("input", attrs);
};

export const createButton = (id: string, text: string, btnClass: string): HTMLElement =>
  element("button", { id, class: btnClass }, text);

// ============ ПАГИНАЦИЯ ============

export const createPagination = (
  prevId: string,
  nextId: string,
  currentPage: number,
  totalPages: number,
  isPrevDisabled: boolean,
  isNextDisabled: boolean
): HTMLElement => {
  return element("div", { class: "pagination-controls" },
    element("button", {
      class: "btn btn-secondary",
      id: prevId,
      disabled: isPrevDisabled ? true : undefined
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

export const resetCarVisualReset = (car: HTMLElement, removeLastPosition = false): void => {
  car.classList.remove("broken");
  car.classList.remove("broken-engine_overheating", "broken-transmission_failure", "broken-start_stall", "broken-random_breakdown");
  car.style.opacity = "1";
  car.style.scale = "1";
  car.style.rotate = "0deg";
  car.style.transform = "translateX(0px)";
  if (removeLastPosition) {
    delete car.dataset.lastPosition;
  }
};
