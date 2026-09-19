import type { Orientation } from "@aembi-play/shared";

/**
 * Aplica a rotação da tela via transform, invertendo largura/altura em
 * 90/270 — PROJECT_BRIEF.md seção 5.6.
 */
export function applyOrientation(
  container: HTMLElement,
  orientation: Orientation,
): void {
  container.style.transform = `rotate(${orientation}deg)`;

  const isPortraitSwap = orientation === 90 || orientation === 270;
  container.style.width = isPortraitSwap ? "100vh" : "100vw";
  container.style.height = isPortraitSwap ? "100vw" : "100vh";
}
