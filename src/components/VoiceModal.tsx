import { useEffect } from 'react';
import { Modal, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { translateText, useLanguage } from '../i18n';
import { ListenControl, useSpeechAccess } from '../speech-access';
import { appSpeechLanguages, dialogText } from '../speech-text';
import { VoiceCommandScope } from '../voice-command-context';
import { VoiceCommandBar } from '../voice-command-ui';

// A visible Listen control inside each dialog, including above native Modal layers.
export function VoiceModal({ children, visible, ...props }: Omit<ModalProps, 'onRequestClose'> & { onRequestClose?: () => void }) {
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const speech = useSpeechAccess();
  const stop = speech?.stop;
  useEffect(() => () => stop?.(), [stop, visible]);
  return <Modal {...props} visible={visible}>
    {visible ? <VoiceCommandScope modal onClose={props.onRequestClose}><View style={{ flex: 1 }}>
      {children}
      <View style={{ position: 'absolute', top: Math.max(16, insets.top + 8), right: 18, maxWidth: '90%', borderRadius: 18, paddingHorizontal: 4, backgroundColor: '#fffefa', borderWidth: 1, borderColor: '#dce5d5', boxShadow: '0px 6px 24px rgba(18, 61, 42, 0.15)' }}>
        <ListenControl text={translateText(dialogText(children), language)} language={appSpeechLanguages[language]} />
        <VoiceCommandBar compact />
      </View>
    </View></VoiceCommandScope> : null}
  </Modal>;
}
