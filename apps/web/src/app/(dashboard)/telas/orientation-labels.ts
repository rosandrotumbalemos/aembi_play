// Rótulos de orientação (seção 2.5) — compartilhado entre os selects de
// pareamento e edição de tela. Existe porque o Select desta versão do Base
// UI não resolve o rótulo a partir dos SelectItem filhos sozinho (mostraria
// o valor cru, ex.: "0", "90") — ver uso via children-function em
// pair-screen-dialog.tsx e edit-screen-dialog.tsx.
export const ORIENTATION_LABELS: Record<string, string> = {
  "0": "0° — paisagem",
  "90": "90° — retrato",
  "180": "180° — paisagem invertida",
  "270": "270° — retrato invertido",
};
