import ExpoModulesCore
import AVFoundation
import CoreHaptics

public final class LivePcmStreamerModule: Module {
  private let chunkEvent = "onPcmChunk"

  private var audioEngine: AVAudioEngine?
  private var converter: AVAudioConverter?
  private var inputFormat: AVAudioFormat?
  private var targetFormat: AVAudioFormat?
  private var isStreaming = false

  private var hapticEngine: CHHapticEngine?

  private func ensureHapticEngine() throws {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
      return
    }

    if hapticEngine == nil {
      hapticEngine = try CHHapticEngine()
      hapticEngine?.isAutoShutdownEnabled = true

      hapticEngine?.resetHandler = { [weak self] in
        do {
          try self?.hapticEngine?.start()
        } catch {
          print("Failed to restart haptic engine after reset: \(error)")
        }
      }
    }

    if let engine = hapticEngine, engine.isMutedForAudio == false {
      try engine.start()
    }
  }

  private func playContinuousHaptic(duration: Double = 0.35) throws {
    guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
      return
    }

    try ensureHapticEngine()

    let safeDuration = max(0.05, min(duration, 1.0))

    let intensity = CHHapticEventParameter(
      parameterID: .hapticIntensity,
      value: 1.0
    )
    let sharpness = CHHapticEventParameter(
      parameterID: .hapticSharpness,
      value: 0.5
    )

    let event = CHHapticEvent(
      eventType: .hapticContinuous,
      parameters: [intensity, sharpness],
      relativeTime: 0,
      duration: safeDuration
    )

    let pattern = try CHHapticPattern(events: [event], parameters: [])
    let player = try hapticEngine!.makePlayer(with: pattern)
    try player.start(atTime: 0)
  }

  public func definition() -> ModuleDefinition {
    Name("LivePcmStreamer")

    Events(chunkEvent)

    AsyncFunction("start") { () async throws in
      if self.isStreaming {
        return
      }

      let session = AVAudioSession.sharedInstance()

      try session.setCategory(
        .playAndRecord,
        mode: .measurement,
        options: [.defaultToSpeaker, .allowBluetooth]
      )
      try session.setPreferredSampleRate(16_000)
      try session.setPreferredIOBufferDuration(0.1)

      if #available(iOS 13.0, *) {
        try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
      }

      try session.setActive(true, options: [])

      let engine = AVAudioEngine()
      let inputNode = engine.inputNode
      let inFormat = inputNode.inputFormat(forBus: 0)

      guard let outFormat = AVAudioFormat(
        commonFormat: .pcmFormatInt16,
        sampleRate: 16_000,
        channels: 1,
        interleaved: true
      ) else {
        throw NSError(
          domain: "LivePcmStreamer",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Failed to create target audio format"]
        )
      }

      guard let converter = AVAudioConverter(from: inFormat, to: outFormat) else {
        throw NSError(
          domain: "LivePcmStreamer",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "Failed to create AVAudioConverter"]
        )
      }

      self.audioEngine = engine
      self.converter = converter
      self.inputFormat = inFormat
      self.targetFormat = outFormat

      let tapFrames = AVAudioFrameCount(max(1024, Int(inFormat.sampleRate / 10.0)))

      inputNode.installTap(onBus: 0, bufferSize: tapFrames, format: inFormat) { [weak self] buffer, _ in
        guard let self = self, let converter = self.converter, let outFormat = self.targetFormat else {
          return
        }

        let ratio = outFormat.sampleRate / buffer.format.sampleRate
        let outputCapacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 16

        guard let outputBuffer = AVAudioPCMBuffer(
          pcmFormat: outFormat,
          frameCapacity: outputCapacity
        ) else {
          return
        }

        var sourceBufferUsed = false
        var conversionError: NSError?

        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
          if sourceBufferUsed {
            outStatus.pointee = .noDataNow
            return nil
          } else {
            sourceBufferUsed = true
            outStatus.pointee = .haveData
            return buffer
          }
        }

        let status = converter.convert(
          to: outputBuffer,
          error: &conversionError,
          withInputFrom: inputBlock
        )

        if status == .error || conversionError != nil {
          return
        }

        guard
          outputBuffer.frameLength > 0,
          let channelData = outputBuffer.int16ChannelData
        else {
          return
        }

        let samples = Int(outputBuffer.frameLength)
        let bytes = samples * MemoryLayout<Int16>.size
        let data = Data(bytes: channelData.pointee, count: bytes)

        self.sendEvent(self.chunkEvent, [
          "base64": data.base64EncodedString()
        ])
      }

      engine.prepare()
      try engine.start()
      self.isStreaming = true
    }

    AsyncFunction("stop") { () async throws in
      guard self.isStreaming else {
        return
      }

      self.audioEngine?.inputNode.removeTap(onBus: 0)
      self.audioEngine?.stop()
      self.audioEngine = nil
      self.converter = nil
      self.inputFormat = nil
      self.targetFormat = nil
      self.isStreaming = false

      try? AVAudioSession.sharedInstance().setActive(
        false,
        options: [.notifyOthersOnDeactivation]
      )
    }

    AsyncFunction("playStrongHaptic") { (duration: Double?) async throws in
      try self.playContinuousHaptic(duration: duration ?? 0.35)
    }
  }
}