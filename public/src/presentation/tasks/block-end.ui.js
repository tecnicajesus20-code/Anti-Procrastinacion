/**
 * FIN DE BLOQUE: ventana "¿Terminaste la tarea?" y lista de pendientes en la campanita.
 * Solo presentación: las respuestas delegan en block-outcome.service; cuándo preguntar lo decide
 * block-end-watcher.service.
 *  - La ventana queda abierta hasta 3 minutos después del fin del bloque. Sin respuesta (o con Escape)
 *    se cierra y el bloque sigue en la campanita, SIN tocar puntos.
 *  - Desde la campanita se puede responder durante 24 h; después cuenta como no realizado.
 */
import { byId } from "../../shared/dom.js";
import { runAction, showMessage } from "../../shared/feedback.js";
import { formatShortDateTime, formatClock, formatMinutesSeconds } from "../../shared/date-time.js";
import { pointsForBlock, penaltyForBlock } from "../../domain/difficulty.js";

/**
 * @param {ReturnType<import("../../application/block-outcome.service.js").createBlockOutcomeService>} blockOutcomes
 */
export function initBlockEndUi(blockOutcomes) {
  const dialog = byId("block-end-dialog");
  const taskLabel = byId("block-end-task");
  const intentLabel = byId("block-end-intent");
  const countdown = byId("block-end-countdown");
  const errorBox = byId("block-end-error");
  const yesButton = byId("block-end-yes");
  const noButton = byId("block-end-no");
  const pendingBox = byId("bell-pending");
  const pendingList = byId("bell-pending-list");
  const badge = byId("bell-badge");

  const queue = [];
  let current = null;
  let timer = null;

  const describe = (item) => `${item.task.title} · ${formatShortDateTime(item.block.start)} a ${formatClock(item.block.end)}`;
  const resultText = (item, done) => (done
    ? `Bloque completado: +${pointsForBlock(item.block)} puntos.`
    : `Bloque registrado como no realizado: −${penaltyForBlock(item.block)} puntos.`);

  function stopTimer() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
  }

  function closeCurrent() {
    stopTimer();
    current = null;
    if (dialog.open) dialog.close();
  }

  function showNext() {
    while (queue.length && Date.now() >= queue[0].closesAt) queue.shift();
    current = queue.shift() ?? null;
    if (!current) return;
    errorBox.hidden = true;
    yesButton.disabled = false;
    noButton.disabled = false;
    taskLabel.textContent = describe(current);
    intentLabel.textContent = current.block.focusIntent ? `Tarea concreta: ${current.block.focusIntent}` : "";
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((current.closesAt - Date.now()) / 1000));
      countdown.textContent = `Si no respondes en ${formatMinutesSeconds(remaining)}, quedará pendiente en la campanita 🔔.`;
      if (remaining <= 0) postpone();
    };
    if (!dialog.open) dialog.showModal();
    tick();
    timer = window.setInterval(tick, 1000);
  }

  /** Sin respuesta: se cierra y queda pendiente (sin penalización). */
  function postpone() {
    if (!current) return;
    const item = current;
    closeCurrent();
    showMessage(`«${item.task.title}» quedó pendiente en la campanita 🔔. Si no respondes en 24 h, contará como no realizado.`);
    showNext();
  }

  async function answer(done) {
    if (!current) return;
    const item = current;
    yesButton.disabled = true;
    noButton.disabled = true;
    errorBox.hidden = true;
    try {
      await blockOutcomes.answer(item.task.id, item.block, done);
      closeCurrent();
      showMessage(resultText(item, done));
      showNext();
    } catch (error) {
      yesButton.disabled = false;
      noButton.disabled = false;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  }

  yesButton.addEventListener("click", () => answer(true));
  noButton.addEventListener("click", () => answer(false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    postpone(); // Escape = responder más tarde desde la campanita
  });

  function prompt(item) {
    queue.push(item);
    if (!current) showNext();
  }

  /** @param {{task: {id: string, title: string}, block: {start: string, end: string}, key: string}[]} pending */
  function renderPending(pending) {
    // Si el bloque del aviso abierto ya se respondió (p. ej. desde la campanita), el aviso se cierra.
    if (current && !pending.some((item) => item.key === current.key)) {
      closeCurrent();
      showNext();
    }
    pendingBox.hidden = pending.length === 0;
    badge.hidden = pending.length === 0;
    badge.textContent = String(pending.length);
    pendingList.replaceChildren(...pending.map((item) => {
      const row = document.createElement("li");
      row.className = "bell__pending-item";
      const text = document.createElement("span");
      text.className = "bell__pending-text";
      text.textContent = describe(item);
      const actions = document.createElement("span");
      actions.className = "bell__pending-actions";
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "bell__item";
      yes.textContent = "✓ Sí";
      yes.setAttribute("aria-label", `Sí terminé: ${item.task.title}`);
      yes.addEventListener("click", () => runAction(() => blockOutcomes.answer(item.task.id, item.block, true), { successText: resultText(item, true) }));
      const no = document.createElement("button");
      no.type = "button";
      no.className = "bell__item bell__item--danger";
      no.textContent = "✗ No";
      no.setAttribute("aria-label", `No terminé: ${item.task.title}`);
      no.addEventListener("click", () => runAction(() => blockOutcomes.answer(item.task.id, item.block, false), { successText: resultText(item, false) }));
      actions.append(yes, no);
      row.append(text, actions);
      return row;
    }));
  }

  return { prompt, renderPending };
}
