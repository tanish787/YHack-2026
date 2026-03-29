import { useCallback, useEffect, useRef, useState } from "react";
import LivePcmStreamer from "../../modules/live-pcm-streamer";

type TokenResponse = {
  token: string;
};

type BeginMessage = {
  type: "Begin";
  id: string;
  expires_at: number;
};

type TurnMessage = {
  type: "Turn";
  transcript: string;
  end_of_turn: boolean;
  turn_is_formatted?: boolean;
  turn_order?: number;
};

type TerminationMessage = {
  type: "Termination";
  audio_duration_seconds: number;
  session_duration_seconds: number;
};

type AssemblyAIMessage = BeginMessage | TurnMessage | TerminationMessage;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function extractNewText(previous: string, current: string) {
  if (!previous) return current;
  if (current.startsWith(previous)) return current.slice(previous.length);
  return current;
}

function tokenizeWithPunctuation(text: string): string[] {
  return text.match(/[A-Za-z']+|[.,!?;]/g) ?? [];
}

function isLikelyFillerLike(tokens: string[], i: number): boolean {
  const current = (tokens[i] || "").toLowerCase();
  if (current !== "like") return false;

  const prev = (tokens[i - 1] || "").toLowerCase();
  const next = (tokens[i + 1] || "").toLowerCase();
  const prev2 = (tokens[i - 2] || "").toLowerCase();
  const next2 = (tokens[i + 2] || "").toLowerCase();

  // -------- strong NON-filler cases --------

  // I like math / we like this / they like pizza
  if (
    ["i", "we", "they", "you"].includes(prev) &&
    next &&
    ![",", ".", "!", "?", ";"].includes(next)
  ) {
    return false;
  }

  // I'd like / would like
  if (prev === "would" || prev2 === "would") return false;
  if (prev.endsWith("'d")) return false;

  // looks like / feels like / sounds like / seems like
  if (
    [
      "look",
      "looks",
      "looked",
      "feel",
      "feels",
      "felt",
      "sound",
      "sounds",
      "sounded",
      "seem",
      "seems",
      "seemed",
    ].includes(prev)
  ) {
    return false;
  }

  // things like / something like / nothing like
  if (["things", "thing", "something", "nothing", "anything"].includes(prev)) {
    return false;
  }

  // was like / were like / I'm like / she's like
  // Treat as quotative/informal speech, not filler, for now.
  if (
    [
      "am",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "i'm",
      "he's",
      "she's",
      "they're",
      "we're",
      "you're",
    ].includes(prev)
  ) {
    return false;
  }

  // -------- strong filler cases --------

  // ", like,"
  if (prev === "," && next === ",") return true;

  // sentence opener: "Like, ..."
  if ((i === 0 || [".", "!", "?"].includes(prev)) && next === ",") return true;

  // pause-ish before, then hedge after
  if (
    [",", "uh", "um"].includes(prev) &&
    [
      "really",
      "just",
      "kind",
      "sort",
      "maybe",
      "literally",
      "basically",
      "honestly",
      "actually",
    ].includes(next)
  ) {
    return true;
  }

  // like really / like just / like kind of / like sort of
  if (
    [
      "really",
      "just",
      "maybe",
      "literally",
      "basically",
      "actually",
      "totally",
      "super",
      "pretty",
    ].includes(next)
  ) {
    return true;
  }

  if (
    (next === "kind" && next2 === "of") ||
    (next === "sort" && next2 === "of")
  ) {
    return true;
  }

  // like five / like ten / like a hundred / like a bunch
  if (
    /^\d+$/.test(next) ||
    [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "hundred",
      "thousand",
      "million",
      "billion",
      "couple",
      "bunch",
      "lot",
      "few",
    ].includes(next)
  ) {
    return true;
  }

  // "..., like this..." with pause before and weak word after
  if (
    [",", ".", "!", "?", ";"].includes(prev) &&
    ["this", "that", "so"].includes(next)
  ) {
    return true;
  }

  return false;
}

function findFillerHits(text: string): string[] {
  const hits: string[] = [];

  // Easy fillers
  const directHits = text.match(/\b(um+|uh+|erm+|hmm+|mm+)\b/gi) ?? [];
  hits.push(...directHits.map((x) => x.toLowerCase()));

  // Phrase fillers
  const phraseHits =
    text.match(/\b(you know|i mean|kind of|sort of)\b/gi) ?? [];
  hits.push(...phraseHits.map((x) => x.toLowerCase()));

  // Heuristic "like"
  const tokens = tokenizeWithPunctuation(text);
  for (let i = 0; i < tokens.length; i += 1) {
    if (isLikelyFillerLike(tokens, i)) {
      hits.push("like");
    }
  }

  return hits;
}

export function useAssemblyAiLive() {
  const wsRef = useRef<WebSocket | null>(null);
  const lastTranscriptRef = useRef("");
  const lastBuzzAtRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lastHits, setLastHits] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const buzzForFiller = async () => {
    const now = Date.now();

    // cooldown so interim updates do not spam haptics
    if (now - lastBuzzAtRef.current < 700) return;

    lastBuzzAtRef.current = now;

    try {
      await LivePcmStreamer.playStrongHaptic(0.35);
    } catch (err) {
      console.warn("Native haptic failed:", err);
    }
  };

  const connect = useCallback(async () => {
    if (!API_BASE_URL) {
      throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const tokenRes = await fetch(`${API_BASE_URL}/assemblyai/token`);
      if (!tokenRes.ok) {
        throw new Error(`Token request failed: ${tokenRes.status}`);
      }

      const { token } = (await tokenRes.json()) as TokenResponse;

      const params = new URLSearchParams({
        sample_rate: "16000",
        speech_model: "u3-rt-pro",
        format_turns: "true",
        token,
      });

      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`,
      );

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data) as AssemblyAIMessage;

          if (msg.type === "Begin") {
            setSessionId(msg.id);
            return;
          }

          if (msg.type === "Turn") {
            const current = msg.transcript ?? "";
            setTranscript(current);

            const delta = extractNewText(lastTranscriptRef.current, current);
            lastTranscriptRef.current = current;

            const hits = findFillerHits(delta);
            if (hits.length > 0) {
              setLastHits(hits);
              await buzzForFiller();
            }

            return;
          }

          if (msg.type === "Termination") {
            setConnected(false);
            setConnecting(false);
            setSessionId(null);
            wsRef.current = null;
            return;
          }
        } catch (parseError) {
          console.error("Bad websocket message:", parseError, event.data);
        }
      };

      ws.onerror = (evt) => {
        console.error("AssemblyAI websocket error:", evt);
        setError("WebSocket error");
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        setSessionId(null);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch (err) {
      setConnecting(false);
      setConnected(false);
      setError(err instanceof Error ? err.message : "Unknown connection error");
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Terminate" }));
      }
      ws.close();
    } catch (err) {
      console.warn("Disconnect error:", err);
    }

    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
    setSessionId(null);
  }, []);

  const sendPcmChunk = useCallback((chunk: ArrayBuffer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(chunk);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setLastHits([]);
    lastTranscriptRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendPcmChunk,
    resetTranscript,
    connected,
    connecting,
    sessionId,
    transcript,
    lastHits,
    error,
  };
}
