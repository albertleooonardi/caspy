// Render browser captures into Caspy's captioned MP4 and WebVTT walkthrough.
// Usage: swift render_walkthrough.swift frames.json output-directory
// Frames are captured through the computer-use tool, never from personal tabs.
import AppKit
import AVFoundation
import ImageIO

struct Scene: Decodable {
    let path: String
    let seconds: Int
    let title: String
    let caption: String
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else { fatalError("Expected frames.json and output directory") }
let scenes = try JSONDecoder().decode([Scene].self, from: Data(contentsOf: URL(fileURLWithPath: arguments[1])))
let directory = URL(fileURLWithPath: arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let destination = directory.appendingPathComponent("caspy-walkthrough.mp4")
if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }

let width = 1440
let height = 1080
let fps: Int32 = 12
let writer = try AVAssetWriter(outputURL: destination, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 1_600_000,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps * 2,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264MainAutoLevel
    ]
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
])
writer.add(input)
guard writer.startWriting() else { fatalError("Could not start video encoding") }
writer.startSession(atSourceTime: .zero)

func frame(_ scene: Scene) throws -> CVPixelBuffer {
    let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: scene.path) as CFURL, nil)!
    let original = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    // Remove Safari's toolbar and private-window chrome from the recording.
    let cropTop = 180
    let image = original.cropping(to: CGRect(x: 0, y: cropTop, width: original.width, height: original.height - cropTop))!
    var optionalBuffer: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true
    ] as CFDictionary, &optionalBuffer)
    let buffer = optionalBuffer!
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                            bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    context.setFillColor(CGColor(red: 0.969, green: 0.957, blue: 0.984, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    let imageHeight = CGFloat(height - 138)
    let scale = min(CGFloat(width) / CGFloat(image.width), imageHeight / CGFloat(image.height))
    let target = CGRect(x: (CGFloat(width) - CGFloat(image.width) * scale) / 2,
                        y: 138 + (imageHeight - CGFloat(image.height) * scale) / 2,
                        width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
    context.interpolationQuality = .high
    context.draw(image, in: target)
    context.setFillColor(CGColor(red: 0.173, green: 0.110, blue: 0.247, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: 138))
    context.setFillColor(CGColor(red: 0.969, green: 0.49, blue: 0.263, alpha: 1))
    context.fill(CGRect(x: 0, y: 134, width: width, height: 4))
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    let title = NSAttributedString(string: scene.title, attributes: [
        .font: NSFont.systemFont(ofSize: 29, weight: .semibold),
        .foregroundColor: NSColor.white
    ])
    title.draw(in: CGRect(x: 38, y: 83, width: width - 76, height: 38))
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 3
    let caption = NSAttributedString(string: scene.caption, attributes: [
        .font: NSFont.systemFont(ofSize: 22),
        .foregroundColor: NSColor(red: 0.91, green: 0.87, blue: 0.95, alpha: 1),
        .paragraphStyle: paragraph
    ])
    caption.draw(in: CGRect(x: 38, y: 14, width: width - 76, height: 62))
    NSGraphicsContext.restoreGraphicsState()
    return buffer
}

func timestamp(_ seconds: Int) -> String {
    String(format: "%02d:%02d:%02d.000", seconds / 3600, (seconds / 60) % 60, seconds % 60)
}

var frameIndex: Int64 = 0
var elapsed = 0
var captions = "WEBVTT\n\n"
for (index, scene) in scenes.enumerated() {
    let buffer = try frame(scene)
    if index == 0 {
        let poster = CIImage(cvPixelBuffer: buffer)
        let rendered = CIContext().createCGImage(poster, from: poster.extent)!
        let output = CGImageDestinationCreateWithURL(directory.appendingPathComponent("caspy-walkthrough-poster.jpg") as CFURL, "public.jpeg" as CFString, 1, nil)!
        CGImageDestinationAddImage(output, rendered, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
        guard CGImageDestinationFinalize(output) else { fatalError("Could not write poster") }
    }
    captions += "\(index + 1)\n\(timestamp(elapsed)) --> \(timestamp(elapsed + scene.seconds))\n\(scene.title)\n\(scene.caption)\n\n"
    for _ in 0..<(scene.seconds * Int(fps)) {
        while !input.isReadyForMoreMediaData {
            if writer.status == .failed { fatalError("Video encoding failed") }
            Thread.sleep(forTimeInterval: 0.003)
        }
        guard adaptor.append(buffer, withPresentationTime: CMTime(value: frameIndex, timescale: fps)) else {
            fatalError("Could not append a video frame")
        }
        frameIndex += 1
    }
    elapsed += scene.seconds
}
input.markAsFinished()
let complete = DispatchSemaphore(value: 0)
writer.endSession(atSourceTime: CMTime(value: frameIndex, timescale: fps))
writer.finishWriting { complete.signal() }
complete.wait()
guard writer.status == .completed else { fatalError("Video export failed") }
try captions.write(to: directory.appendingPathComponent("caspy-walkthrough.en.vtt"), atomically: true, encoding: .utf8)
print("Exported \(elapsed)-second captioned walkthrough, \(width)x\(height), H.264 MP4.")
