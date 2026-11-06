export type CommandAction = {
  id: string; scope: string; label: string; aliases?: string[];
  kind: 'action' | 'select' | 'submit'; run: () => void | Promise<void>;
  disabled?: boolean; selected?: boolean; confirm?: boolean; preview?: string;
};
type Scope = { id: string; parent: string; modal: boolean; close?: () => void };
export type CommandResult = { message: string; navigate?: string; back?: boolean };

export function commandText(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[०-९౦-౯೦-೯௦-௯]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code - [0x0966, 0x0c66, 0x0ce6, 0x0be6].find(start => code >= start && code < start + 10)!);
  }).replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

const routes: Record<string, string[]> = {
  dashboard: ['home', 'dashboard', 'హోమ్', 'హోం', 'मुख्य पृष्ठ', 'होम', 'முகப்பு', 'ಮುಖಪುಟ'],
  weather: ['weather', 'forecast', 'వాతావరణం', 'మౌసమ్', 'मौसम', 'வானிலை', 'ಹವಾಮಾನ', 'हवामान'],
  market: ['market', 'market prices', 'mandi prices', 'మార్కెట్', 'మార్కెట్ ధరలు', 'बाजार', 'मंडी भाव', 'சந்தை', 'ಮಾರುಕಟ್ಟೆ'],
  'farm-plan': ['farm plan', 'tasks', 'పనులు', 'వ్యవసాయ ప్రణాళిక', 'खेत की योजना', 'काम', 'பண்ணை திட்டம்'],
  disease: ['crop scan', 'scan', 'disease scan', 'పంట స్కాన్', 'पौधे की जांच', 'फसल जांच', 'பயிர் பரிசோதனை'],
  map: ['map', 'farm map', 'satellite map', 'మ్యాప్', 'పటం', 'नक्शा', 'வரைபடம்'],
  yield: ['yield', 'yield planning', 'దిగుబడి', 'उपज', 'மகசூல்'],
  assistant: ['ask ai', 'assistant', 'ai', 'సహాయకుడు', 'सहायक', 'உதவியாளர்'],
  'assistant?intent=profit': ['profit', 'profit planner', 'profit routes', 'లాభం', 'లాభ ప్రణాళిక', 'मुनाफा', 'लाभ', 'லாபம்'],
  schemes: ['schemes', 'government schemes', 'పథకాలు', 'योजनाएं', 'योजनाएँ', 'திட்டங்கள்'],
  notifications: ['notifications', 'alerts', 'నోటిఫికేషన్లు', 'सूचनाएं', 'அறிவிப்புகள்'],
  community: ['community', 'farmer community', 'రైతు సంఘం', 'किसान समुदाय', 'விவசாயிகள் சமூகம்'],
  profile: ['profile', 'my profile', 'ప్రొఫైల్', 'प्रोफाइल', 'சுயவிவரம்'],
};
const cleanRequest = (text: string) => commandText(text).replace(/^(?:please |can you |could you )+/, '').replace(/ please$/, '');
const removeOpen = (text: string) => text.replace(/^(?:open|show|go to|take me to|खोलो|खोलें|दिखाओ|తెరువు|చూపించు|திற|திறக்கவும்) /, '').replace(/ (?:open|खोलो|खोलें|दिखाओ|తెరువు|చూపించు|திற|திறக்கவும்)$/, '');
const is = (text: string, values: string[]) => values.some(value => commandText(value) === text);

export function inferCommandKind(label: string): CommandAction['kind'] {
  return /^(save|continue|verify|get verification|find my|ask ai for my|use this pin|post|send|confirm)/i.test(label) ? 'submit' : 'action';
}

export class VoiceCommandRegistry {
  private actions = new Map<string, CommandAction>();
  private scopes = new Map<string, Scope>();
  private listeners = new Set<() => void>();
  private version = 0;
  private epoch = 0;
  private focused: string | null = null;
  pending: { action: CommandAction; epoch: number; expires: number } | null = null;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  snapshot = () => this.version;
  private changed() { this.version += 1; this.listeners.forEach(fn => fn()); }
  scopeEpoch = () => this.epoch;
  currentScope() {
    const list = [...this.scopes.values()];
    const depth = (scope: Scope) => { let count = 0; let parent = scope.parent; const seen = new Set<string>(); while (parent && !seen.has(parent)) { seen.add(parent); count += 1; parent = this.scopes.get(parent)?.parent ?? ''; } return count; };
    const modal = list.filter(scope => scope.modal).reduce<Scope | undefined>((best, scope) => !best || depth(scope) >= depth(best) ? scope : best, undefined);
    return modal ?? list.filter(scope => !scope.modal).at(-1) ?? { id: 'root', parent: '', modal: false };
  }
  mountScope(scope: Scope) {
    this.scopes.set(scope.id, scope); this.epoch += 1; this.pending = null; this.focused = null; this.changed();
    return () => { this.scopes.delete(scope.id); this.epoch += 1; this.pending = null; this.focused = null; this.changed(); };
  }
  register(action: CommandAction) {
    this.actions.set(action.id, action); this.changed();
    return () => { if (this.actions.get(action.id) === action) { this.actions.delete(action.id); this.changed(); } };
  }
  focus(id: string) { this.focused = id; }
  invalidateConfirmation() { if (this.pending) { this.pending = null; this.changed(); } }
  available() { return [...this.actions.values()].filter(action => action.scope === this.currentScope().id && !action.disabled); }
  async execute(transcript: string, expectedEpoch = this.epoch, now = Date.now()): Promise<CommandResult> {
    if (expectedEpoch !== this.epoch) return { message: 'The screen changed. Please give the command again.' };
    const text = cleanRequest(transcript);
    const scope = this.currentScope();
    if (!text || text.length > 200) return { message: 'Say one short command, such as open weather or submit.' };
    if (is(text, ['cancel', 'never mind', 'रद्द करो', 'रद्द', 'వద్దు', 'రద్దు', 'ரத்து'])) {
      if (this.pending) { this.pending = null; this.changed(); return { message: 'Action cancelled. Nothing was submitted.' }; }
      if (scope.modal && scope.close) { scope.close(); return { message: 'Dialog closed.' }; }
      return { message: 'No pending action to cancel.' };
    }
    if (is(text, ['confirm', 'yes confirm', 'confirm action', 'पुष्टि', 'पुष्टि करो', 'నిర్ధారించు', 'అవును నిర్ధారించు', 'உறுதிப்படுத்து'])) {
      const pending = this.pending;
      this.pending = null; this.changed();
      if (!pending || pending.epoch !== this.epoch || pending.expires < now || this.actions.get(pending.action.id) !== pending.action || pending.action.disabled)
        return { message: 'That confirmation is no longer valid. Review the form and say submit again.' };
      return this.run(pending.action);
    }
    // A different command always revokes a prior confirmation.
    if (this.pending) { this.pending = null; this.changed(); }
    if (is(text, ['close', 'close dialog', 'बंद करो', 'మూసివేయి', 'மூடு'])) {
      if (scope.modal && scope.close) { scope.close(); return { message: 'Dialog closed.' }; }
      return { message: 'There is no open dialog to close.' };
    }
    if (is(text, ['go back', 'back', 'पीछे जाओ', 'వెనక్కి', 'பின்னால்'])) {
      if (scope.modal) { scope.close?.(); return { message: scope.close ? 'Dialog closed.' : 'Close this dialog before going back.' }; }
      return { message: 'Going back.', back: true };
    }
    const destination = removeOpen(text);
    const route = Object.entries(routes).find(([, aliases]) => is(destination, aliases));
    if (route) return scope.modal ? { message: 'Close this dialog before opening another screen.' } : { message: `Opening ${route[1][0]}.`, navigate: `/${route[0]}` };
    const available = this.available();
    let matches: CommandAction[] = [];
    const exact = available.filter(action => [action.label, ...(action.aliases ?? [])].some(label => commandText(label) === text));
    const selection = text.replace(/^(?:select|choose|pick|चुनो|चुनें|ఎంచుకో|ఎంచుకోండి|தேர்வு செய்) /, '').replace(/ (?:चुनो|चुनें|ఎంచుకో|ఎంచుకోండి|தேர்வு செய்)$/, '');
    const selecting = selection !== text;
    const choices = available.filter(action => action.kind === 'select');
    if (exact.length) matches = exact;
    else if (selecting && is(selection, ['this', 'this one', 'इसे', 'ఇది', 'దీన్ని', 'இதை'])) {
      const focused = choices.find(action => action.id === this.focused);
      matches = focused ? [focused] : choices.filter(action => action.selected);
      if (!matches.length && choices.length === 1) matches = choices;
    } else if (selecting) {
      const ordinal = ['first', 'second', 'third', 'fourth', 'fifth', 'पहला', 'दूसरा', 'तीसरा', 'మొదటి', 'రెండవ', 'మూడవ'].indexOf(selection.replace(/^option /, ''));
      const wordIndex = ordinal < 0 ? -1 : ordinal < 5 ? ordinal : ordinal < 8 ? ordinal - 5 : ordinal - 8;
      const numeric = /^(?:option )?\d+$/.test(selection) ? Number(selection.replace('option ', '')) - 1 : wordIndex;
      if (numeric >= 0) matches = choices[numeric] ? [choices[numeric]] : [];
      else matches = choices.filter(action => [action.label, ...(action.aliases ?? [])].some(label => commandText(label) === selection));
    } else if (is(text, ['submit', 'save', 'continue', 'जमा करो', 'सहेजें', 'आगे बढ़ो', 'సమర్పించు', 'సేవ్', 'కొనసాగించు', 'சமர்ப்பி', 'சேமி'])) {
      matches = available.filter(action => action.kind === 'submit');
    } else {
      const name = text.replace(/^(?:tap|press|click) /, '');
      matches = available.filter(action => [action.label, ...(action.aliases ?? [])].some(label => commandText(label) === name));
    }
    if (matches.length !== 1) return { message: matches.length > 1 ? 'More than one action matches. Say the full button label or select an option by number.' : 'No unique action matched. Say a visible button or option name. “Select this” needs one focused or selected option.' };
    const action = matches[0];
    if (action.kind === 'submit' || action.confirm) {
      this.pending = { action, epoch: this.epoch, expires: now + 120_000 }; this.changed();
      return { message: `Review “${action.label}”. Say confirm to proceed, or cancel.` };
    }
    return this.run(action);
  }
  private async run(action: CommandAction): Promise<CommandResult> {
    try { await action.run(); return { message: `Activated “${action.label}”. Check the screen for results or validation messages.` }; }
    catch { return { message: 'The action could not complete. Please check the form and try again.' }; }
  }
}
