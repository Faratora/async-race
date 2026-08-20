import { element } from "./builder.ts";

type Attributes = Record<string, string | number | boolean | undefined>;

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
