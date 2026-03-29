export type StopMicStream = () => Promise<void>;

export async function startMicPcmStream(
  _sendPcmChunk: (chunk: ArrayBuffer) => void,
): Promise<StopMicStream> {
  throw new Error("Live PCM streaming is only implemented on iOS dev builds.");
}
