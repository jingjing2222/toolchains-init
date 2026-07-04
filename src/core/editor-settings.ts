import fs from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

export async function addVsCodeExtensionRecommendations(cwd: string, recommendations: string[]) {
  const file = path.join(cwd, ".vscode", "extensions.json");
  const json = (await readJsonObject(file)) ?? {};
  const current = Array.isArray(json.recommendations) ? json.recommendations : [];
  json.recommendations = [...new Set([...current, ...recommendations].filter(isString))].sort();
  await writeJson(file, json);
}

export async function addVsCodeSettings(cwd: string, settings: JsonObject) {
  await mergeJsonFile(path.join(cwd, ".vscode", "settings.json"), settings);
}

export async function addZedSettings(cwd: string, settings: JsonObject) {
  await mergeJsonFile(path.join(cwd, ".zed", "settings.json"), settings);
}

async function mergeJsonFile(file: string, patch: JsonObject) {
  const json = (await readJsonObject(file)) ?? {};
  mergeDeep(json, patch);
  await writeJson(file, json);
}

async function readJsonObject(file: string): Promise<JsonObject | null> {
  try {
    const parsed = JSON.parse(stripJsonComments(await fs.readFile(file, "utf8"))) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: JsonObject) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function mergeDeep(target: JsonObject, patch: JsonObject) {
  for (const [key, value] of Object.entries(patch)) {
    if (isJsonObject(value) && isJsonObject(target[key])) {
      mergeDeep(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function stripJsonComments(input: string) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (!inString && current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (!inString && current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += current;

    if (escaped) {
      escaped = false;
    } else if (current === "\\") {
      escaped = true;
    } else if (current === '"') {
      inString = !inString;
    }
  }

  return output;
}
