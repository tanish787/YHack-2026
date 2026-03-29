import { requireNativeView } from 'expo';
import * as React from 'react';

import { LivePcmStreamerViewProps } from './LivePcmStreamer.types';

const NativeView: React.ComponentType<LivePcmStreamerViewProps> =
  requireNativeView('LivePcmStreamer');

export default function LivePcmStreamerView(props: LivePcmStreamerViewProps) {
  return <NativeView {...props} />;
}
