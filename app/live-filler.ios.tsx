import { useRef, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import { ENABLE_LIVE_FILLER } from "../src/liveFiller/enabled";
import { startMicPcmStream, StopMicStream } from "../src/liveFiller/mic";
import { useAssemblyAiLive } from "../src/liveFiller/useAssemblyAiLive";

export default function LiveFillerIOS() {
  const { connect, disconnect, sendPcmChunk, transcript, lastHits, connected } =
    useAssemblyAiLive();

  const stopMicRef = useRef<StopMicStream | null>(null);
  const [running, setRunning] = useState(false);

  const start = async () => {
    if (!ENABLE_LIVE_FILLER) return;

    await connect();
    stopMicRef.current = await startMicPcmStream(sendPcmChunk);
    setRunning(true);
  };

  const stop = async () => {
    await stopMicRef.current?.();
    stopMicRef.current = null;
    disconnect();
    setRunning(false);
  };

  if (!ENABLE_LIVE_FILLER) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text>Live filler tracking is disabled in this build.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 80 }}>
      <Button
        title={
          running ? "Stop live filler tracking" : "Start live filler tracking"
        }
        onPress={running ? stop : start}
      />
      <Text style={{ marginTop: 12 }}>
        Connected: {connected ? "yes" : "no"}
      </Text>
      <Text style={{ marginTop: 12 }}>
        Last hits: {lastHits.length ? lastHits.join(", ") : "none"}
      </Text>
      <ScrollView style={{ marginTop: 24 }}>
        <Text>{transcript || "Say something..."}</Text>
      </ScrollView>
    </View>
  );
}
