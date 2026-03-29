import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
} from "expo-audio";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

type BackgroundCaptureStopResult = {
  uri: string | null;
  durationMillis: number;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function ensureApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
  }

  return API_BASE_URL;
}

export function useBackgroundCaptureRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  const start = useCallback(async () => {
    if (recording) return;

    if (Platform.OS === "web") {
      throw new Error("Background recording is not supported on web.");
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Microphone permission not granted");
    }

    await setAudioModeAsync({
      allowsRecording: true,
      shouldPlayInBackground: true,
      allowsBackgroundRecording: true,
      playsInSilentMode: true,
    });

    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  }, [recording, recorder]);

  const stop = useCallback(async (): Promise<BackgroundCaptureStopResult> => {
    if (!recording) {
      return { uri: recorder.uri, durationMillis: 0 };
    }

    try {
      await recorder.stop();
      const status = recorder.getStatus();
      setRecording(false);

      return {
        uri: recorder.uri,
        durationMillis: status.durationMillis,
      };
    } finally {
      await setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
        shouldPlayInBackground: false,
        playsInSilentMode: true,
      });
    }
  }, [recording, recorder]);

  return {
    recording,
    start,
    stop,
  };
}

export async function transcribeBackgroundRecording(
  recordingUri: string,
): Promise<string> {
  const apiBaseUrl = ensureApiBaseUrl();

  const localAudioResponse = await fetch(recordingUri);
  if (!localAudioResponse.ok) {
    throw new Error("Unable to read recorded audio file.");
  }

  const audioBlob = await localAudioResponse.blob();
  const response = await fetch(`${apiBaseUrl}/assemblyai/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": audioBlob.type || "application/octet-stream",
    },
    body: audioBlob,
  });

  const rawBody = await response.text();
  let payload: { text?: string; error?: string } | null = null;

  try {
    payload = JSON.parse(rawBody) as { text?: string; error?: string };
  } catch {
    const preview = rawBody.slice(0, 140).trim();
    if (preview.startsWith("<")) {
      throw new Error(
        "Transcription endpoint returned HTML instead of JSON. Check EXPO_PUBLIC_API_BASE_URL and make sure your server is running.",
      );
    }

    throw new Error(
      `Transcription endpoint returned non-JSON response (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || "Failed to transcribe recorded audio.");
  }

  return payload.text || "";
}
