import type { CharacterObject } from "../types";
//input: .character
//output: CharacterObject[]

//phase 1: remove comment section // and /**/

function stripComments(text: string): string {
  // Remove block comments /**/

  // regrex wrapped in / / like "" of string
  const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, "");

  return withoutBlockComments.replace(/\/\/.*$/gm, "");
}

function parseValue(rawValue: string): string | number | boolean {
  const trimmed = rawValue.trim();

  // boolean check
  if (trimmed == "true") return true;
  if (trimmed == "false") return false;

  //nummber check
  if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);

  return trimmed;
}

export function parseCharacter(content: string): CharacterObject[] {
  const cleanContent = stripComments(content);

  const results: CharacterObject[] = [];

  const blockRegex = /([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g;

  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(cleanContent)) !== null) {
    const objectName = blockMatch[1].trim();
    const body = blockMatch[2];

    const properties: Record<string, string | number | boolean> = {};
    const propRegex = /([a-zA-Z0-9_]+)\s*=\s*([^;]+);/g;
    let propMatch: RegExpExecArray | null;

    while ((propMatch = propRegex.exec(body)) !== null) {
      const varName = propMatch[1].trim();
      const rawVal = propMatch[2];
      properties[varName] = parseValue(rawVal);
    }
    results.push({
      name: objectName,
      properties: properties,
    });
  }

  return results;
}
