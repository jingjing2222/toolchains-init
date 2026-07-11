import type { ToolchainDefinition } from "./toolchain-adapter";

export const toolchainCapabilities = {
  "mobile-ota": { label: "mobile OTA updates", cardinality: "many" },
  "database-orm": { label: "database ORM", cardinality: "many" },
  "ui-components": { label: "UI components", cardinality: "many" },
  "local-backend": { label: "local backend", cardinality: "many" },
  "e2e-testing": { label: "end-to-end testing", cardinality: "many" },
  "component-workshop": { label: "component workshop", cardinality: "many" },
  formatting: { label: "formatting", cardinality: "one" },
  linting: { label: "linting", cardinality: "one" },
  "spell-checking": { label: "spell checking", cardinality: "many" },
  "secret-scanning": { label: "secret scanning", cardinality: "many" },
  versioning: { label: "release versioning", cardinality: "many" },
  "editor-sdks": { label: "editor SDKs", cardinality: "many" },
} as const;

export type ToolchainCapability = keyof typeof toolchainCapabilities;

export const toolchainAreaLabels = {
  app: "App & Services",
  testing: "Testing & UI",
  quality: "Code Quality",
  release: "Release",
  editor: "Editor",
} as const;

export type CatalogNotice = {
  code: "overlapping-capability";
  message: string;
  toolIds: readonly string[];
};

export function compareToolchainOrder(
  left: Pick<ToolchainDefinition, "id" | "order">,
  right: Pick<ToolchainDefinition, "id" | "order">,
) {
  return left.order - right.order || left.id.localeCompare(right.id);
}

export function buildCatalogNotices(
  toolchains: readonly ToolchainDefinition[],
): readonly CatalogNotice[] {
  const notices: CatalogNotice[] = [];

  for (const [capability, definition] of Object.entries(toolchainCapabilities)) {
    if (definition.cardinality !== "one") {
      continue;
    }
    const providers = toolchains.filter((toolchain) =>
      toolchain.capabilities.includes(capability as ToolchainCapability),
    );
    if (providers.length < 2) {
      continue;
    }

    notices.push({
      code: "overlapping-capability",
      message: `${providers.map((toolchain) => toolchain.label).join(", ")} provide overlapping ${definition.label} setup.`,
      toolIds: providers.map((toolchain) => toolchain.id),
    });
  }

  return notices;
}
