export type AppThemeId =
  | "t4lk-dark"
  | "t4lk-light"
  | "zed"
  | "vscode-dark"
  | "vscode-light"
  | "dracula"
  | "nord";

export type ThemeCategory = "dark" | "light";

interface AppThemeConfig {
  readonly label: string;
  readonly category: ThemeCategory;
  /** Preview colors: [background, accent, surface] */
  readonly preview: readonly [string, string, string];
}

const THEMES: Record<AppThemeId, AppThemeConfig> = {
  "t4lk-dark": {
    label: "T4lk Dark",
    category: "dark",
    preview: [
      "oklch(0.13 0.01 260)",
      "oklch(0.72 0.15 195)",
      "oklch(0.15 0.01 260)",
    ],
  },
  "t4lk-light": {
    label: "T4lk Light",
    category: "light",
    preview: [
      "oklch(0.97 0.005 260)",
      "oklch(0.50 0.15 195)",
      "oklch(0.99 0.003 260)",
    ],
  },
  zed: {
    label: "Zed",
    category: "dark",
    preview: [
      "oklch(0.22 0.02 250)",
      "oklch(0.72 0.12 240)",
      "oklch(0.24 0.02 250)",
    ],
  },
  "vscode-dark": {
    label: "VS Code Dark",
    category: "dark",
    preview: [
      "oklch(0.17 0.005 250)",
      "oklch(0.65 0.17 240)",
      "oklch(0.18 0.005 250)",
    ],
  },
  "vscode-light": {
    label: "VS Code Light",
    category: "light",
    preview: [
      "oklch(0.99 0 0)",
      "oklch(0.52 0.17 240)",
      "oklch(0.98 0.002 250)",
    ],
  },
  dracula: {
    label: "Dracula",
    category: "dark",
    preview: [
      "oklch(0.22 0.02 280)",
      "oklch(0.72 0.16 300)",
      "oklch(0.24 0.02 280)",
    ],
  },
  nord: {
    label: "Nord",
    category: "dark",
    preview: [
      "oklch(0.25 0.02 240)",
      "oklch(0.75 0.08 200)",
      "oklch(0.27 0.02 240)",
    ],
  },
};

export const APP_THEME_IDS: readonly AppThemeId[] = Object.keys(
  THEMES,
) as AppThemeId[];

export function getAppThemeLabel(id: AppThemeId): string {
  return THEMES[id].label;
}

export function getAppThemeCategory(id: AppThemeId): ThemeCategory {
  return THEMES[id].category;
}

export function getAppThemePreview(
  id: AppThemeId,
): readonly [string, string, string] {
  return THEMES[id].preview;
}

export function applyAppTheme(id: AppThemeId): void {
  if (id === "t4lk-dark") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = id;
  }
}
