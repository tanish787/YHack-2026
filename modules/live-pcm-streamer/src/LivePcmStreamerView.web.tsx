import * as React from 'react';

import { LivePcmStreamerViewProps } from './LivePcmStreamer.types';

export default function LivePcmStreamerView(props: LivePcmStreamerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
