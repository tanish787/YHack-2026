import { NativeModule, requireNativeModule } from "expo";
import type { LivePcmStreamerModuleEvents } from "./LivePcmStreamer.types";

declare class LivePcmStreamerModule extends NativeModule<LivePcmStreamerModuleEvents> {
  start(): Promise<void>;
  stop(): Promise<void>;
  playStrongHaptic(duration?: number): Promise<void>;
}

export default requireNativeModule<LivePcmStreamerModule>("LivePcmStreamer");
