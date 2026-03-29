import { useAssemblyAiLive } from "@/src/liveFiller/useAssemblyAiLive";
import { useRef, useState } from "react";
import { Button, Image, ScrollView, Text, View } from "react-native";
import { startMicPcmStream } from "../../src/liveFiller/mic";

export default function SpeechToText() {
  const {
    connect,
    disconnect,
    sendPcmChunk,
    connected,
    connecting,
    transcript,
    lastHits,
    error,
  } = useAssemblyAiLive();

  const stopMicRef = useRef<null | (() => Promise<void>)>(null);
  const [running, setRunning] = useState(false);

  const start = async () => {
    try {
      await connect();
      stopMicRef.current = await startMicPcmStream(sendPcmChunk);
      setRunning(true);
    } catch (err) {
      console.error("Start failed:", err);
    }
  };

  const stop = async () => {
    await stopMicRef.current?.();
    stopMicRef.current = null;
    disconnect();
    setRunning(false);
  };

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 12, gap: 12 }}>
      <Image
        source={require("../../assets/images/SpeechTree.png")}
        style={{
          width: "100%",
          maxWidth: 940,
          height: 256,
          marginBottom: -72,
          marginTop: -64,
          alignSelf: "flex-start",
          marginLeft: -64,
        }}
        resizeMode="contain"
      />
      <Button
        title={running ? "Stop speech capture" : "Start speech capture"}
        onPress={running ? stop : start}
      />

      <Text>Connecting: {connecting ? "yes" : "no"}</Text>
      <Text>Connected: {connected ? "yes" : "no"}</Text>

      {error ? <Text style={{ color: "red" }}>Error: {error}</Text> : null}

      <Text style={{ fontWeight: "600", marginTop: 8 }}>Last filler hits:</Text>
      <Text>{lastHits.length ? lastHits.join(", ") : "none yet"}</Text>

      <Text style={{ fontWeight: "600", marginTop: 12 }}>Live transcript:</Text>

      <ScrollView
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          minHeight: 200,
        }}
      >
        <Text>{transcript || "No transcript yet..."}</Text>
      </ScrollView>
    </View>
  );
}
