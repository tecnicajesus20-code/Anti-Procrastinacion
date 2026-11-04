/**
 * CATEGORÍAS EN PANTALLA: llena los selectores de categoría y atiende la ventana "Gestionar categorías".
 * Solo presentación: crear y eliminar delegan en category.service (que reasigna las tareas a Ocio).
 * Los botones que abren la ventana se marcan en el HTML con data-category-manage.
 */
import { byId } from "../../shared/dom.js";

/**
 * @param {ReturnType<import("../../application/category.service.js").createCategoryService>} categoryService
 * @param {string[]} selectIds  Selectores <select> a mantener sincronizados con la lista de categorías
 */
export function initCategoryUi(categoryService, selectIds) {
  const selects = selectIds.map((id) => byId(id));
  const dialog = byId("category-dialog");
  const list = byId("category-list");
  const form = byId("category-form");
  const nameInput = byId("category-name");
  const colorInput = byId("category-color");
  const errorBox = byId("category-dialog-error");

  function fillSelect(select, categories) {
    const previous = select.value;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = select.dataset.placeholder || "Selecciona una categoría…";
    select.replaceChildren(placeholder, ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `${category.icon} ${category.name}`;
      return option;
    }));
    select.value = categories.some((category) => category.id === previous) ? previous : "";
  }

  function showError(error) {
    errorBox.textContent = error?.message || String(error);
    errorBox.hidden = false;
  }

  function renderList(categories) {
    list.replaceChildren(...categories.map((category) => {
      const item = document.createElement("li");
      item.className = "category-list__item";
      const swatch = document.createElement("span");
      swatch.className = "category-swatch";
      swatch.style.setProperty("--category-color", category.color);
      const name = document.createElement("span");
      name.className = "category-list__name";
      name.textContent = `${category.icon} ${category.name}`;
      item.append(swatch, name);
      if (category.base) {
        const tag = document.createElement("small");
        tag.className = "category-list__tag";
        tag.textContent = "Base";
        item.append(tag);
      } else {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "work-group__btn work-group__btn--danger";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", async () => {
          const count = categoryService.countTasks(category.id);
          const detail = count ? ` Sus ${count} ${count === 1 ? "tarea pasará" : "tareas pasarán"} a Ocio.` : "";
          if (!window.confirm(`¿Eliminar la categoría «${category.name}»?${detail}`)) return;
          errorBox.hidden = true;
          remove.disabled = true;
          try {
            await categoryService.remove(category.id);
          } catch (error) {
            remove.disabled = false;
            showError(error);
          }
        });
        item.append(remove);
      }
      return item;
    }));
  }

  function render(categories) {
    selects.forEach((select) => fillSelect(select, categories));
    renderList(categories);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    try {
      await categoryService.add({ name: nameInput.value, color: colorInput.value });
      nameInput.value = "";
      nameInput.focus();
    } catch (error) {
      showError(error);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-category-manage]")) return;
    errorBox.hidden = true;
    dialog.showModal();
    nameInput.focus();
  });
  byId("category-dialog-close").addEventListener("click", () => dialog.close());

  categoryService.subscribe(render);
  render(categoryService.getAll());
}
