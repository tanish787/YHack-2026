import LivePcmStreamer from "live-pcm-streamer";
import { Button, Text, View } from "react-native";

export default function HapticTest() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text style={{ marginBottom: 12, fontSize: 16 }}>
        Tap to test haptics
      </Text>
      <View style={{ width: "100%", maxWidth: 320 }}>
        <Button
          title="Test haptic"
          onPress={async () => {
            console.log("manual haptic fired");
            await LivePcmStreamer.playStrongHaptic(0.35);
          }}
        />
      </View>
    </View>
  );
}
