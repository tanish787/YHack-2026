import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './LivePcmStreamer.types';

type LivePcmStreamerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class LivePcmStreamerModule extends NativeModule<LivePcmStreamerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(LivePcmStreamerModule, 'LivePcmStreamerModule');
