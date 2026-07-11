export const reservedDirectSelectors = new Set([
  "help",
  "package-manager",
  "plan",
  "target",
  "version",
]);

export function assertDirectSelector(selector: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(selector)) {
    throw new Error(`Direct CLI selector must use lowercase kebab-case: ${selector}`);
  }
  if (reservedDirectSelectors.has(selector)) {
    throw new Error(`Direct CLI selector is reserved: ${selector}`);
  }
}
