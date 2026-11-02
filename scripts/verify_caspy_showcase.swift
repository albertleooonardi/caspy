// Verify a generated film's media tracks, decoded audio, and moving frames.
// Usage: executable video.mp4 storyboard.json output-directory
import AppKit
import AVFoundation
import ImageIO

let args=CommandLine.arguments
precondition(args.count==4)
let asset=AVURLAsset(url:URL(fileURLWithPath:args[1]))
let scenes=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:args[2]))) as! [[String:Any]]
let expected=scenes.reduce(0) { $0+($1["seconds"] as! Int) }
let output=URL(fileURLWithPath:args[3],isDirectory:true)
try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
let video=asset.tracks(withMediaType:.video), audio=asset.tracks(withMediaType:.audio)
precondition(video.count==1 && audio.count==1,"Expected one video and one audio track")
precondition(abs(asset.duration.seconds-Double(expected))<0.1,"Duration mismatch")
precondition(video[0].naturalSize==CGSize(width:1600,height:900),"Unexpected frame dimensions")
precondition(abs(video[0].nominalFrameRate-30)<0.01,"Expected 30 fps")
let reader=try AVAssetReader(asset:asset)
let decoded=AVAssetReaderTrackOutput(track:audio[0],outputSettings:[AVFormatIDKey:kAudioFormatLinearPCM,AVLinearPCMIsFloatKey:true,AVLinearPCMBitDepthKey:32,AVLinearPCMIsNonInterleaved:false,AVSampleRateKey:44100,AVNumberOfChannelsKey:2])
reader.add(decoded);precondition(reader.startReading())
var peak:Double=0, energy:Double=0, samples=0, clipped=0
while let sample=decoded.copyNextSampleBuffer() {
    guard let block=CMSampleBufferGetDataBuffer(sample) else { continue }
    var bytes=Data(count:CMBlockBufferGetDataLength(block))
    bytes.withUnsafeMutableBytes { raw in _=CMBlockBufferCopyDataBytes(block,atOffset:0,dataLength:raw.count,destination:raw.baseAddress!) }
    bytes.withUnsafeBytes { raw in
        let values=raw.bindMemory(to:Float.self)
        for value in values { let x=Double(value);precondition(x.isFinite);peak=max(peak,abs(x));energy+=x*x;samples+=1;if abs(x)>=1 { clipped+=1 } }
    }
}
precondition(reader.status == .completed,"Audio decode failed")
precondition(samples>44100*2*(expected-1),"Audio is too short")
let rms=sqrt(energy/Double(samples))
precondition(rms>0.01 && rms<0.30 && clipped==0,"Silent or clipped mix")
let generator=AVAssetImageGenerator(asset:asset);generator.appliesPreferredTrackTransform=true
generator.requestedTimeToleranceBefore = .zero;generator.requestedTimeToleranceAfter = .zero
func image(_ seconds:Double)->CGImage { try! generator.copyCGImage(at:CMTime(seconds:seconds,preferredTimescale:600),actualTime:nil) }
func save(_ image:CGImage,_ name:String) {
    let dest=CGImageDestinationCreateWithURL(output.appendingPathComponent(name) as CFURL,"public.jpeg" as CFString,1,nil)!
    CGImageDestinationAddImage(dest,image,[kCGImageDestinationLossyCompressionQuality:0.92] as CFDictionary);CGImageDestinationFinalize(dest)
}
let first=image(2), second=image(3)
save(first,"decoded-2s.jpg");save(second,"decoded-3s.jpg")
func pixels(_ image:CGImage)->[UInt8] {
    var bytes=[UInt8](repeating:0,count:180*180*4)
    let crop=image.cropping(to:CGRect(x:1050,y:150,width:450,height:450))!
    let c=CGContext(data:&bytes,width:180,height:180,bitsPerComponent:8,bytesPerRow:180*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    c.draw(crop,in:CGRect(x:0,y:0,width:180,height:180));return bytes
}
let p1=pixels(first),p2=pixels(second)
let movement=zip(p1,p2).reduce(0.0) { $0+abs(Double($1.0)-Double($1.1)) }/Double(p1.count)
precondition(movement>0.3,"Character motion was not detected")
let report:[String:Any]=["duration_seconds":asset.duration.seconds,"width":1600,"height":900,"fps":video[0].nominalFrameRate,"video_tracks":video.count,"audio_tracks":audio.count,"decoded_audio_peak_dbfs":20*log10(peak),"decoded_audio_rms_dbfs":20*log10(rms),"clipped_samples":clipped,"character_roi_mean_pixel_change":movement,"bytes":(try FileManager.default.attributesOfItem(atPath:args[1])[.size] as! NSNumber).intValue]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try data.write(to:output.appendingPathComponent("media-qa.json"));print(String(data:data,encoding:.utf8)!)
