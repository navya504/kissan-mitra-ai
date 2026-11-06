// Keep a whole dialog within each provider request without cutting off its ending.
export function speechChunks(text: string, limit = 2200): string[] {
  const chunks: string[] = [];
  let remaining = text.replace(/\s+/g, ' ').trim();
  while (remaining.length > limit) {
    const boundary = remaining.lastIndexOf(' ', limit);
    const end = boundary > 0 ? boundary : limit;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// React children can include nested text and custom buttons with a title prop.
// Input values and placeholders are deliberately left to the field's own controls.
export function dialogText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(dialogText).filter(Boolean).join(' ');
  if (!node || typeof node !== 'object' || !('props' in node)) return '';
  const props = node.props as { children?: unknown; title?: unknown; value?: unknown; placeholder?: unknown };
  if ('value' in props || 'placeholder' in props) return '';
  return [typeof props.title === 'string' ? props.title : '', dialogText(props.children)].filter(Boolean).join(' ');
}

export const appSpeechLanguages = {
  English: 'en-IN', Telugu: 'te-IN', Hindi: 'hi-IN', Tamil: 'ta-IN', Kannada: 'kn-IN', Marathi: 'mr-IN',
} as const;

function normalizedDigits(text: string) {
  return text.normalize('NFKC').trim().replace(/[०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯]/g, digit => {
    const starts = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66];
    const code = digit.charCodeAt(0);
    return String(code - starts.find(start => code >= start && code <= start + 9)!);
  });
}

// A transcriber may return number words instead of digit characters. Match whole
// words so names and places containing a number word are never rewritten.
const spokenNumbers: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  'సున్నా': '0', 'సున్న': '0', 'జీరో': '0', 'ఒకటి': '1', 'ఒక్కటి': '1',
  'రెండు': '2', 'మూడు': '3', 'నాలుగు': '4', 'ఐదు': '5',
  'ఆరు': '6', 'ఏడు': '7', 'ఎనిమిది': '8', 'తొమ్మిది': '9', 'పది': '10',
  point: '.', dot: '.', 'పాయింట్': '.', 'చుక్క': '.',
};

export function numericSpeechText(text: string) {
  return normalizedDigits(text).replace(/\p{L}[\p{L}\p{M}]*/gu, word => spokenNumbers[word.toLowerCase()] ?? word)
    .replace(/\s*\.\s*/g, '.');
}

export function dictatedValue(text: string, keyboardType?: string, maxLength?: number) {
  const numeric = ['number-pad', 'phone-pad', 'decimal-pad'].includes(keyboardType ?? '');
  let value = numeric ? numericSpeechText(text) : normalizedDigits(text);
  if (keyboardType === 'number-pad' || keyboardType === 'phone-pad') value = value.replace(/\D/g, '');
  if (keyboardType === 'decimal-pad') value = value.replace(/[^\d.]/g, '');
  return maxLength === undefined ? value : value.slice(0, maxLength);
}
