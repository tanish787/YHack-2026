import { decode as decodeBase64 } from "base-64";
import { requestRecordingPermissionsAsync } from "expo-audio";
import LivePcmStreamer from "live-pcm-streamer";

export type StopMicStream = () => Promise<void>;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = decodeBase64(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export async function startMicPcmStream(
  sendPcmChunk: (chunk: ArrayBuffer) => void,
): Promise<StopMicStream> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission not granted");
  }

  const sub = LivePcmStreamer.addListener("onPcmChunk", (event) => {
    const chunk = base64ToArrayBuffer(event.base64);
    sendPcmChunk(chunk);
  });

  await LivePcmStreamer.start();

  return async () => {
    sub.remove();
    await LivePcmStreamer.stop();
  };
}
