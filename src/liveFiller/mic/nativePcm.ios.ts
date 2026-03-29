export type StopMicStream = () => Promise<void>;

export async function startMicPcmStream(
  onChunk: (chunk: ArrayBuffer) => void,
): Promise<StopMicStream> {
  // real iOS PCM streamer here
  return async () => {};
}
