import {
  AudioQuality,
  IOSOutputFormat,
  RecordingOptions,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { transcribe } from '@/lib/coach';
import { WordEntry } from '@/lib/types';

// SPEC 4.6: tap to start, tap to stop, max 30 seconds.
const MAX_MS = 30_000;

// 16 kHz mono WAV on iOS: small (about 1 MB for 30 s) and read reliably by Whisper.
const OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export type VoiceState = 'idle' | 'recording' | 'transcribing';

// Records a spoken answer and hands the transcript to `onText`.
export function useVoiceAnswer(word: WordEntry, onText: (text: string) => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const { durationMillis } = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>('idle');
  const stopping = useRef(false);

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    setState('transcribing');
    try {
      await recorder.stop();
      // Give playback back to the speaker button (expo-speech).
      await setAudioModeAsync({ allowsRecording: false });
      const text = recorder.uri ? await transcribe(recorder.uri, word) : null;
      if (text) onText(text);
      else Alert.alert('Could not transcribe', 'Please try again, or type your answer.');
    } finally {
      stopping.current = false;
      setState('idle');
    }
  };

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone is off', 'Allow the microphone for Expo Go in the iPhone Settings to answer by voice.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState('recording');
    } catch (e) {
      Alert.alert('Could not start recording', e instanceof Error ? e.message : String(e));
    }
  };

  // Stop automatically at the 30 second limit.
  useEffect(() => {
    if (state === 'recording' && durationMillis >= MAX_MS) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, durationMillis]);

  const toggle = () => {
    if (state === 'recording') stop();
    else if (state === 'idle') start();
  };

  return { state, seconds: Math.floor(durationMillis / 1000), toggle };
}
