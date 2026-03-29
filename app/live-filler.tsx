import { Text, View } from "react-native";

export default function LiveFillerFallback() {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text>Live filler tracking is only enabled on the iPhone dev build.</Text>
    </View>
  );
}
