export type LivePcmStreamerModuleEvents = {
  onPcmChunk(event: { base64: string }): void;
};
