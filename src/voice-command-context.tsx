import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { VoiceCommandRegistry, type CommandAction } from './voice-command-engine';

const RegistryContext = createContext<VoiceCommandRegistry | null>(null);
const ScopeContext = createContext('root');
export const useVoiceCommands = () => useContext(RegistryContext);
export const useVoiceCommandScope = () => useContext(ScopeContext);

export function VoiceCommandProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new VoiceCommandRegistry());
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

export function VoiceCommandScope({ children, modal = false, onClose }: { children: ReactNode; modal?: boolean; onClose?: () => void }) {
  const registry = useVoiceCommands();
  const parent = useVoiceCommandScope();
  const id = useId();
  useEffect(() => registry?.mountScope({ id, parent, modal, close: onClose }), [registry, id, parent, modal, onClose]);
  return <ScopeContext.Provider value={id}>{children}</ScopeContext.Provider>;
}

export function useVoiceAction(action: Omit<CommandAction, 'id' | 'scope'>) {
  const registry = useVoiceCommands();
  const scope = useVoiceCommandScope();
  const id = useId();
  const { label, run, kind, disabled, selected, confirm, preview } = action;
  const handler = useRef(run);
  useEffect(() => { handler.current = run; }, [run]);
  const execute = useCallback(() => handler.current(), []);
  const aliasKey = JSON.stringify(action.aliases ?? []);
  useEffect(() => registry?.register({ id, scope, label, run: execute, kind, disabled, selected, confirm, preview, aliases: JSON.parse(aliasKey) }),
    [registry, id, scope, label, execute, kind, disabled, selected, confirm, preview, aliasKey]);
  return () => registry?.focus(id);
}

export function VoiceAction({ label, kind = 'action', confirm, preview, aliases, onPress, ...props }: PressableProps & {
  label: string; kind?: CommandAction['kind']; confirm?: boolean; preview?: string; aliases?: string[]; onPress: () => void;
}) {
  const registry = useVoiceCommands();
  const focus = useVoiceAction({ label, kind, confirm, preview, aliases, run: onPress, disabled: Boolean(props.disabled), selected: Boolean(props.accessibilityState?.selected || props.accessibilityState?.checked) });
  return <Pressable {...props} accessibilityLabel={props.accessibilityLabel ?? label} onPress={() => { registry?.invalidateConfirmation(); onPress(); }} onFocus={event => { focus(); props.onFocus?.(event); }} onHoverIn={event => { focus(); props.onHoverIn?.(event); }} />;
}
