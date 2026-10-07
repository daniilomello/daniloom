import Foundation
import CoreGraphics
import CoreAudio

let request = CommandLine.arguments.contains("--request")
let screenGranted = request ? (CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess()) : CGPreflightScreenCaptureAccess()
var output: [String: Any] = ["screen": screenGranted]
if request {
    if #available(macOS 14.2, *) {
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
        description.name = "Daniloom · Permissão de áudio do sistema"
        description.isPrivate = true
        description.muteBehavior = .unmuted
        var tap: AudioObjectID = kAudioObjectUnknown
        let status = AudioHardwareCreateProcessTap(description, &tap)
        output["systemAudioRequested"] = true
        output["systemAudioTapStatus"] = status
        if status == noErr && tap != kAudioObjectUnknown {
            AudioHardwareDestroyProcessTap(tap)
        }
    } else {
        output["systemAudioRequested"] = false
    }
}
if let data = try? JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]), let json = String(data: data, encoding: .utf8) { print(json) }
