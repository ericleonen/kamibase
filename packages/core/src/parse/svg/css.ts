/**
 * Just enough CSS to read an Illustrator or Inkscape export.
 *
 * Those two write nearly every crease pattern SVG in circulation, and both put
 * the colours in a `<style>` block of class rules (`.st0{stroke:#FF0000;}`)
 * rather than on the elements. A converter that only reads presentation
 * attributes sees a document with no colours at all.
 *
 * Selectors are matched compound-only: `line`, `.st0`, `#layer1`, `*` and
 * combinations of those. Anything with a combinator, a pseudo-class or an
 * attribute test is reported and skipped, because a half-implemented matcher
 * that silently mis-applies a rule is worse than one that says what it ignored.
 */

export interface CssRule {
  readonly selector: string;
  readonly tag: string | null;
  readonly id: string | null;
  readonly classes: readonly string[];
  /** CSS specificity, as `id * 100 + class * 10 + tag`. */
  readonly specificity: number;
  readonly order: number;
  readonly declarations: Readonly<Record<string, string>>;
}

export interface StylesheetResult {
  readonly rules: readonly CssRule[];
  readonly skipped: readonly string[];
}

const COMPOUND = /^(\*|[a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/;

/** Parse the concatenated text of every `<style>` element in the document. */
export function parseStylesheet(text: string): StylesheetResult {
  const rules: CssRule[] = [];
  const skipped: string[] = [];
  const body = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // At-rule blocks are conditional (`@media print`) or irrelevant
    // (`@font-face`). Removing them whole is the only way not to apply a
    // print-only rule to the screen document.
    .replace(/@[^{;]*\{(?:[^{}]|\{[^{}]*\})*\}/g, (block) => {
      skipped.push(block.slice(0, block.indexOf("{")).trim());
      return "";
    })
    .replace(/@[^{;]*;/g, "");

  const BLOCK = /([^{}]+)\{([^{}]*)\}/g;
  let match = BLOCK.exec(body);
  while (match !== null) {
    const selectorList = match[1]!.trim();
    const declarations = parseDeclarations(match[2]!);
    if (selectorList.startsWith("@")) {
      skipped.push(selectorList);
    } else {
      for (const selector of selectorList.split(",")) {
        const trimmed = selector.trim();
        if (trimmed === "") continue;
        const parsed = parseSelector(trimmed, rules.length, declarations);
        if (parsed) rules.push(parsed);
        else skipped.push(trimmed);
      }
    }
    match = BLOCK.exec(body);
  }

  return { rules, skipped };
}

export interface ElementIdentity {
  readonly tag: string;
  readonly id: string | undefined;
  readonly classes: readonly string[];
}

/**
 * Declarations from every matching rule, merged in specificity then source
 * order, which is the cascade for a document with no `!important` and no
 * author/user-agent split.
 */
export function matchStylesheet(
  rules: readonly CssRule[],
  element: ElementIdentity,
): Record<string, string> {
  const matched = rules
    .filter((rule) => matches(rule, element))
    .sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  const result: Record<string, string> = {};
  for (const rule of matched) Object.assign(result, rule.declarations);
  return result;
}

function matches(rule: CssRule, element: ElementIdentity): boolean {
  if (rule.tag !== null && rule.tag !== element.tag) return false;
  if (rule.id !== null && rule.id !== element.id) return false;
  return rule.classes.every((className) => element.classes.includes(className));
}

function parseSelector(
  selector: string,
  order: number,
  declarations: Readonly<Record<string, string>>,
): CssRule | null {
  const match = COMPOUND.exec(selector);
  if (!match) return null;

  const tagPart = match[1];
  const rest = match[2] ?? "";
  const classes: string[] = [];
  let id: string | null = null;
  for (const token of rest.match(/[.#][\w-]+/g) ?? []) {
    if (token.startsWith(".")) classes.push(token.slice(1));
    else id = token.slice(1);
  }
  const tag = tagPart === undefined || tagPart === "*" ? null : tagPart.toLowerCase();

  return {
    selector,
    tag,
    id,
    classes,
    specificity: (id ? 100 : 0) + classes.length * 10 + (tag ? 1 : 0),
    order,
    declarations,
  };
}

/** Split a `style="…"` attribute or a rule body into property/value pairs. */
export function parseDeclarations(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (property !== "" && value !== "") result[property] = value;
  }
  return result;
}
