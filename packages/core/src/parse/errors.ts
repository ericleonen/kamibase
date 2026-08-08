/**
 * Thrown when input is not the format at all: unparseable JSON, an XML
 * document that is not an ORIPA file, a `.cp` with no usable lines.
 *
 * Everything *recoverable* comes back as a warning on the parse result or as a
 * typed defect from the validator instead; this is reserved for "there is no
 * crease pattern here", which is a different answer to the user (DESIGN.md
 * §8.2: "unsupported? → here's how to export from <tool>").
 */
export class ParseError extends Error {
  override readonly name = "ParseError";
  readonly format: string;
  /** 1-based line number, when the format is line-oriented. */
  readonly line?: number;

  constructor(format: string, message: string, line?: number) {
    super(line === undefined ? `${format}: ${message}` : `${format}:${line}: ${message}`);
    this.format = format;
    if (line !== undefined) this.line = line;
  }
}
