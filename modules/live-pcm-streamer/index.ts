// Reexport the native module. On web, it will be resolved to LivePcmStreamerModule.web.ts
// and on native platforms to LivePcmStreamerModule.ts
export { default } from './src/LivePcmStreamerModule';
export { default as LivePcmStreamerView } from './src/LivePcmStreamerView';
export * from  './src/LivePcmStreamer.types';
