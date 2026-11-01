// Replace a video's audio without re-encoding its animation.
// Usage: swift remix_video_audio.swift video.mp4 audio.m4a output.mp4
import AVFoundation
let args=CommandLine.arguments
guard args.count==4 else { fatalError("Expected video, audio, and output paths") }
let videoAsset=AVURLAsset(url:URL(fileURLWithPath:args[1]))
let audioAsset=AVURLAsset(url:URL(fileURLWithPath:args[2]))
let composition=AVMutableComposition()
let video=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!
let audio=composition.addMutableTrack(withMediaType:.audio,preferredTrackID:kCMPersistentTrackID_Invalid)!
let duration=videoAsset.duration
precondition(duration.seconds>0 && audioAsset.duration.seconds>=duration.seconds-0.05)
try video.insertTimeRange(CMTimeRange(start:.zero,duration:duration),of:videoAsset.tracks(withMediaType:.video)[0],at:.zero)
try audio.insertTimeRange(CMTimeRange(start:.zero,duration:duration),of:audioAsset.tracks(withMediaType:.audio)[0],at:.zero)
let destination=URL(fileURLWithPath:args[3])
if FileManager.default.fileExists(atPath:destination.path) { try FileManager.default.removeItem(at:destination) }
let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetPassthrough)!
export.outputURL=destination;export.outputFileType = .mp4;export.shouldOptimizeForNetworkUse=true
let completed=DispatchSemaphore(value:0)
export.exportAsynchronously { completed.signal() };completed.wait()
guard export.status == .completed else { fatalError("Could not mux audio: \(String(describing:export.error))") }
let final=AVURLAsset(url:destination)
precondition(final.tracks(withMediaType:.video).count==1 && final.tracks(withMediaType:.audio).count==1)
precondition(abs(final.duration.seconds-duration.seconds)<0.1)
print("Replaced soundtrack; preserved \(duration.seconds)-second animation and video track.")
