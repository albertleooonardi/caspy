// Caspy text-led explainer: original vector motion and a music-only soundtrack.
// No recorded screens, pointers, or spoken audio.
// Usage: executable scenes.json character.png capture-directory output-directory [--stills]
import AppKit
import AVFoundation
import ImageIO

struct Scene: Decodable { let title: String; let caption: String; let seconds: Int }
let args = CommandLine.arguments
guard args.count >= 5 else { fatalError("Expected scene, character, capture, and output paths") }
let scenes = try JSONDecoder().decode([Scene].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let output = URL(fileURLWithPath: args[4], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let W: CGFloat = 1440, H: CGFloat = 810
let fps: Int32 = 24
let duration: Double = 56
let ink = NSColor(red:0.173,green:0.110,blue:0.247,alpha:1)
let purple = NSColor(red:0.43,green:0.30,blue:0.58,alpha:1)
let muted = NSColor(red:0.45,green:0.35,blue:0.51,alpha:1)
let orange = NSColor(red:0.97,green:0.49,blue:0.26,alpha:1)
let lavender = NSColor(red:0.92,green:0.88,blue:0.96,alpha:1)
let paper = NSColor(red:0.973,green:0.958,blue:0.985,alpha:1)
func rect(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->CGRect { CGRect(x:x,y:H-y-h,width:w,height:h) }
func clamp(_ x:Double)->Double { min(1,max(0,x)) }
func ease(_ x:Double)->Double { let t=clamp(x);return 1-pow(1-t,3) }
func smooth(_ x:Double)->Double { let t=clamp(x);return t*t*(3-2*t) }
func load(_ path:String)->CGImage { CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(URL(fileURLWithPath:path) as CFURL,nil)!,0,nil)! }
func color(_ c:NSColor,_ alpha:Double=1)->CGColor { c.withAlphaComponent(CGFloat(alpha)).cgColor }
func round(_ c:CGContext,_ r:CGRect,_ radius:CGFloat=20,_ fill:NSColor=NSColor.white,_ alpha:Double=1) {
    c.setFillColor(color(fill,alpha));c.addPath(CGPath(roundedRect:r,cornerWidth:radius,cornerHeight:radius,transform:nil));c.fillPath()
}
func text(_ c:CGContext,_ value:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ width:CGFloat=1300,_ height:CGFloat=160,_ shade:NSColor=ink,_ weight:NSFont.Weight = .regular,_ alpha:Double=1,_ alignment:NSTextAlignment = .left) {
    let p=NSMutableParagraphStyle();p.lineSpacing=3;p.alignment=alignment
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(cgContext:c,flipped:false)
    NSAttributedString(string:value,attributes:[.font:NSFont.systemFont(ofSize:size,weight:weight),.foregroundColor:shade.withAlphaComponent(CGFloat(alpha)),.paragraphStyle:p]).draw(in:rect(x,y,width,height))
    NSGraphicsContext.restoreGraphicsState()
}
func outline(_ c:CGContext,_ r:CGRect,_ radius:CGFloat,_ shade:NSColor,_ line:CGFloat=2,_ alpha:Double=1) {
    c.setStrokeColor(color(shade,alpha));c.setLineWidth(line);c.addPath(CGPath(roundedRect:r,cornerWidth:radius,cornerHeight:radius,transform:nil));c.strokePath()
}
func trimCharacter(_ image:CGImage)->CGImage {
    let w=image.width,h=image.height;var bytes=[UInt8](repeating:0,count:w*h*4)
    let ctx=CGContext(data:&bytes,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(image,in:CGRect(x:0,y:0,width:w,height:h))
    var l=w,r=0,t=h,b=0
    for y in 0..<h { for x in 0..<w where bytes[(y*w+x)*4+3]>20 { l=min(l,x);r=max(r,x);t=min(t,y);b=max(b,y) } }
    return image.cropping(to:CGRect(x:max(0,l-8),y:max(0,t-8),width:min(w-l,r-l+17),height:min(h-t,b-t+17))) ?? image
}
let character=trimCharacter(load(args[2]))
func characterAt(_ c:CGContext,_ box:CGRect,_ t:Double,_ scale:CGFloat=1) {
    let bob=CGFloat(sin(t*1.8))*12,tilt=CGFloat(sin(t*1.1))*0.025
    let s=min(box.width/CGFloat(character.width),box.height/CGFloat(character.height))*scale
    c.saveGState();c.translateBy(x:box.midX,y:box.midY+bob);c.rotate(by:tilt)
    c.setShadow(offset:CGSize(width:0,height:-10),blur:24,color:color(purple,0.13))
    c.draw(character,in:CGRect(x:-CGFloat(character.width)*s/2,y:-CGFloat(character.height)*s/2,width:CGFloat(character.width)*s,height:CGFloat(character.height)*s));c.restoreGState()
}
func candy(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ s:CGFloat,_ angle:CGFloat,_ shade:NSColor=orange,_ alpha:Double=1) {
    c.saveGState();c.translateBy(x:x,y:H-y);c.rotate(by:angle);c.setFillColor(color(shade,alpha))
    c.addPath(CGPath(roundedRect:CGRect(x:-s*0.45,y:-s*0.25,width:s*0.9,height:s*0.5),cornerWidth:s*0.12,cornerHeight:s*0.12,transform:nil));c.fillPath()
    for direction:CGFloat in [-1,1] { c.move(to:CGPoint(x:direction*s*0.42,y:0));c.addLine(to:CGPoint(x:direction*s*0.85,y:s*0.30));c.addLine(to:CGPoint(x:direction*s*0.85,y:-s*0.30));c.closePath();c.fillPath() }
    c.setStrokeColor(color(.white,0.8*alpha));c.setLineWidth(max(1,s*0.07));c.move(to:CGPoint(x:-s*0.16,y:-s*0.22));c.addLine(to:CGPoint(x:s*0.1,y:s*0.22));c.strokePath();c.restoreGState()
}
func star(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ radius:CGFloat,_ t:Double,_ alpha:Double=1) {
    let s=radius*CGFloat(0.7+0.3*sin(t));c.setFillColor(color(purple,alpha));let path=CGMutablePath()
    path.move(to:CGPoint(x:x,y:H-y+s));path.addQuadCurve(to:CGPoint(x:x+s,y:H-y),control:CGPoint(x:x+s*0.15,y:H-y+s*0.15));path.addQuadCurve(to:CGPoint(x:x,y:H-y-s),control:CGPoint(x:x+s*0.15,y:H-y-s*0.15));path.addQuadCurve(to:CGPoint(x:x-s,y:H-y),control:CGPoint(x:x-s*0.15,y:H-y-s*0.15));path.addQuadCurve(to:CGPoint(x:x,y:H-y+s),control:CGPoint(x:x-s*0.15,y:H-y+s*0.15));c.addPath(path);c.fillPath()
}
func pill(_ c:CGContext,_ title:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ fill:NSColor=lavender,_ shade:NSColor=purple) {
    round(c,rect(x,y,w,40),20,fill);text(c,title,x+15,y+10,14,w-30,25,shade,.semibold)
}
func button(_ c:CGContext,_ title:String,_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ pulse:Double=0) {
    round(c,rect(x,y+4,w,58),13,NSColor(red:0.76,green:0.35,blue:0.18,alpha:1))
    round(c,rect(x,y-CGFloat(pulse)*2,w,58),13,orange)
    text(c,title,x+22,y+17-CGFloat(pulse)*2,20,w-44,30,ink,.semibold)
}
func ghost(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ t:Double) {
    let r=rect(x,y+CGFloat(sin(t*2))*6,size,size)
    c.saveGState();c.translateBy(x:r.minX,y:r.minY);c.setFillColor(NSColor.white.cgColor);c.setStrokeColor(purple.cgColor);c.setLineWidth(4)
    let p=CGMutablePath();p.move(to:CGPoint(x:size*0.15,y:0));p.addLine(to:CGPoint(x:size*0.15,y:size*0.55));p.addCurve(to:CGPoint(x:size*0.85,y:size*0.55),control1:CGPoint(x:size*0.15,y:size*1.15),control2:CGPoint(x:size*0.85,y:size*1.15));p.addLine(to:CGPoint(x:size*0.85,y:0))
    for i in stride(from:8,through:2,by:-1) { p.addLine(to:CGPoint(x:size*CGFloat(i)/10,y:i%2==0 ? 0:size*0.12)) };p.closeSubpath();c.addPath(p);c.drawPath(using:.fillStroke)
    c.setFillColor(ink.cgColor);for v:CGFloat in [0.37,0.63] { c.fillEllipse(in:CGRect(x:size*(v-0.04),y:size*0.5,width:size*0.08,height:size*0.12)) };c.fillEllipse(in:CGRect(x:size*0.46,y:size*0.32,width:size*0.08,height:size*0.09));c.restoreGState()
}
// Damped overshoot: each entrance settles quickly, leaving time to read.
func spring(_ t:Double)->CGFloat { t <= 0 ? 0:CGFloat(1-exp(-7*t)*cos(11*t)) }
func pop(_ c:CGContext,_ box:CGRect,_ t:Double,_ delay:Double=0,_ draw:()->Void) {
    guard t>delay else { return }
    let elapsed=t-delay,p=spring(elapsed/0.85),scale=0.78+0.22*p
    c.saveGState();c.setAlpha(CGFloat(ease(elapsed/0.25)))
    c.translateBy(x:box.midX,y:box.midY-45*(1-p));c.scaleBy(x:scale,y:scale)
    c.translateBy(x:-box.midX,y:-box.midY);draw();c.restoreGState()
}
func heading(_ c:CGContext,_ value:String,_ t:Double) {
    pop(c,rect(60,108,1320,95),t) { text(c,value,60,108,53,1320,95,ink,.bold,1,.center) }
}
func drawScene(_ c:CGContext,_ index:Int,_ t:Double) {
    switch index {
    case 0,6:
        let outro=index==6
        c.setFillColor(color(lavender,0.8));c.fillEllipse(in:rect(830,130,510,480))
        c.setStrokeColor(color(purple,0.18));c.setLineWidth(2);c.strokeEllipse(in:rect(790,100,580,535))
        for i in 0..<10 { let a=Double(i)*0.9+t*0.17;star(c,1090+CGFloat(cos(a))*285,370+CGFloat(sin(a))*260,CGFloat(7+i%3*3),t+Double(i),0.4) }
        pop(c,rect(865,110,440,530),t,0.15) { characterAt(c,rect(865,110,440,530),t,1+CGFloat(sin(t*3))*0.015) }
        pop(c,rect(70,132,320,40),t,0.1) { pill(c,outro ? "YOUR TURN, LITTLE HEISTER":"MEET YOUR CANDY GUARDIAN",70,132,320) }
        pop(c,rect(70,208,770,190),t,0.3) { text(c,outro ? "Big charm.\nTiny ghost.":"Cute face.\nTough negotiator.",70,208,66,780,190,ink,.bold) }
        pop(c,rect(74,420,690,100),t,0.65) { text(c,outro ? "Bring your best story.\nCaspy is waiting.":"One precious basket. Three prompts.\nCan you charm Caspy into sharing?",74,420,28,690,100,muted,.medium) }
        if outro {
            pop(c,rect(74,550,340,58),t,1.1) { button(c,"Start a demo heist  →",74,550,340,0.5+0.5*sin(t*3));text(c,"A scripted preview. No real mint.",77,630,18,650,35,muted) }
        } else {
            for (i,label) in ["3 prompts","1 little ghost","Trick or Treat"].enumerated() {
                let x=CGFloat(74+i*220)
                pop(c,rect(x,560,205,40),t,1+Double(i)*0.23) { pill(c,label,x,560,205) }
            }
        }
        candy(c,1304,151+CGFloat(sin(t*2))*15,34,CGFloat(t*0.3));candy(c,849,576+CGFloat(cos(t))*8,27,CGFloat(-t*0.4),purple)
    case 1:
        heading(c,"Your little heist starts here.",t)
        pop(c,rect(90,237,755,396),t,0.2) {
            round(c,rect(90,245,755,388),28,lavender);round(c,rect(90,237,755,388),28,.white)
            pill(c,"THE HEIST  /  DEMO",125,266,255)
            characterAt(c,rect(128,333,200,235),t)
            text(c,"One sweet mission.",373,350,32,430,60,ink,.bold)
            text(c,"Win over the guardian\nof the candy basket.",375,414,26,415,100,muted)
            button(c,"Start a demo heist  →",372,540,390,0.5+0.5*sin(t*3))
        }
        let steps=["01  Open The heist","02  Start a demo heist","03  Bring your best words"]
        for (i,label) in steps.enumerated() {
            let y=CGFloat(265+i*112)
            pop(c,rect(910,y,445,82),t,0.6+Double(i)*0.45) { round(c,rect(910,y,445,82),20,i==1 ? orange:lavender);text(c,label,934,y+26,23,400,42,ink,.semibold) }
        }
        pop(c,rect(965,620,330,40),t,2) { pill(c,"No wallet. Just imagination.",965,620,330) }
    case 2:
        heading(c,"Your words are the magic.",t)
        pop(c,rect(60,220,330,395),t,0.1) { characterAt(c,rect(60,220,330,395),t) }
        pop(c,rect(435,230,925,420),t,0.25) { round(c,rect(435,230,925,420),26,.white);outline(c,rect(435,230,925,420),26,lavender) }
        text(c,"DEMO CHAT",469,254,16,350,30,purple,.bold)
        let prompt="I’ll carry your basket through the haunted woods. Even brave ghosts deserve a little help."
        pop(c,rect(575,308,744,125),t,0.65) {
            round(c,rect(575,308,744,125),20,NSColor(red:1,green:0.93,blue:0.88,alpha:1))
            text(c,String(prompt.prefix(Int(ease((t-0.65)/2.2)*Double(prompt.count)))),601,331,25,691,92,ink,.medium)
        }
        pop(c,rect(1035,470,283,58),t,2.3) { button(c,t>3 ? "Prompt sent  ✓":"Send prompt  ↗",1035,470,283,t>2.5 && t<3 ? sin((t-2.5)*6):0) }
        pop(c,rect(470,470,530,128),t,3.3) {
            round(c,rect(470,470,530,128),20,lavender)
            text(c,"A sweet idea…\nKeep the story going!",495,494,26,480,90,purple,.semibold)
        }
        for (i,label) in ["Tell a story","Offer a trade","Try a little humor"].enumerated() {
            pop(c,rect(56,CGFloat(210+i*68),330,40),t,0.8+Double(i)*0.3) { if t<3 { pill(c,label,56,CGFloat(210+i*68),330) } }
        }
    case 3:
        heading(c,"Three chances. Make them count.",t)
        let titles=["A clever trade","A little heart","One last story"]
        let examples=["Offer to carry\nCaspy’s candy basket.","Make room for\na shy little ghost.","Give your story\na sweet ending."]
        for i in 0..<3 {
            let x=CGFloat(80+i*435),used=t>Double(i)*1.6+2.2
            pop(c,rect(x,240,410,315),t,0.3+Double(i)*0.3) {
                let hop=used ? -CGFloat(abs(sin(min(1,t-(Double(i)*1.6+2.2))*Double.pi)))*18:0
                let y:CGFloat=240+hop
                round(c,rect(x,y,410,315),24,.white);outline(c,rect(x,y,410,315),24,used ? purple:lavender,used ? 3:2)
                candy(c,x+205,y+60,54,CGFloat(sin(t*2+Double(i)))*0.14,used ? purple:orange)
                text(c,titles[i],x+25,y+117,29,360,55,ink,.bold,1,.center)
                text(c,examples[i],x+25,y+181,23,360,90,muted,.regular,1,.center)
                if used { pill(c,"PROMPT SENT  ✓",x+112,y+292,190) }
            }
        }
        pop(c,rect(245,622,950,40),t,1.5) { pill(c,"Choose Treat or Trick in Preview outcome before your first prompt.",245,622,950) }
    case 4:
        heading(c,"Trick or Treat? A keepsake either way.",t)
        for i in 0..<2 {
            let x:CGFloat=i==0 ? 255:790
            pop(c,rect(x,230,395,415),t,0.2+Double(i)*0.4) {
                round(c,rect(x,237,395,408),27,lavender);round(c,rect(x,230,395,408),27,i==0 ? NSColor(red:1,green:0.91,blue:0.81,alpha:1):lavender)
                if i==0 { characterAt(c,rect(x+89,245,218,240),t) }
                else { ghost(c,x+95,267,205,t) }
                text(c,i==0 ? "THE TREAT":"THE TRICK",x+25,512,31,345,48,ink,.bold,1,.center)
                text(c,i==0 ? "A sweet little victory.":"A brave little heist.",x+20,568,22,355,45,muted,.medium,1,.center)
            }
        }
        for i in 0..<20 {
            let phase=(t*0.14+Double(i)*0.137).truncatingRemainder(dividingBy:1)
            candy(c,100+CGFloat(i*67),210+CGFloat(phase)*430,CGFloat(8+i%3*3),CGFloat(t*0.7+Double(i)),i%2==0 ? orange:purple,0.5)
        }
    case 5:
        heading(c,"Your keepsake moment.",t)
        pop(c,rect(90,235,700,415),t,0.2) {
            round(c,rect(90,242,700,408),28,lavender);round(c,rect(90,235,700,408),28,.white)
            pill(c,"SIMULATED CLAIM",122,265,260)
            characterAt(c,rect(126,343,224,225),t)
            text(c,"A tiny trophy.\nA sweet memory.",385,348,32,370,115,ink,.bold)
            button(c,t>4.3 ? "Claim simulated  ✓":"Simulate claim",385,516,345,t<4 ? 0.5+0.5*sin(t*3):0)
            text(c,"Preview only · No real NFT",126,600,22,620,36,muted,.medium,1,.center)
        }
        for (i,label) in ["Open your result","Choose Claim","Simulate claim"].enumerated() {
            let y=CGFloat(263+i*112),complete=t>1.2+Double(i)*1.4
            pop(c,rect(860,y,490,82),t,0.5+Double(i)*0.45) {
                round(c,rect(860,y,490,82),20,complete ? lavender:.white)
                text(c,complete ? "✓":"0\(i+1)",885,y+21,29,60,50,purple,.bold)
                text(c,label,957,y+27,25,370,42,ink,.semibold)
            }
        }
        pop(c,rect(918,622,370,40),t,4.5) { pill(c,"Done! No real transaction.",918,622,370) }
    default: break
    }
}
func renderFrame(_ time:Double)->CVPixelBuffer {
    var optional:CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault,Int(W),Int(H),kCVPixelFormatType_32ARGB,[kCVPixelBufferCGImageCompatibilityKey:true,kCVPixelBufferCGBitmapContextCompatibilityKey:true] as CFDictionary,&optional)
    let buffer=optional!;CVPixelBufferLockBaseAddress(buffer,[]);defer { CVPixelBufferUnlockBaseAddress(buffer,[]) }
    let c=CGContext(data:CVPixelBufferGetBaseAddress(buffer),width:Int(W),height:Int(H),bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
    c.setFillColor(paper.cgColor);c.fill(CGRect(x:0,y:0,width:W,height:H))
    c.setFillColor(color(lavender,0.32));c.fillEllipse(in:rect(1040,-125,520,500));c.fillEllipse(in:rect(-200,400,450,450))
    for i in 0..<12 { star(c,CGFloat(50+i*121),100+CGFloat((i*83)%530)+CGFloat(sin(time*0.6+Double(i)))*13,4,time+Double(i),0.13) }
    let index=min(6,Int(time/8)),local=time-Double(index)*8
    if index>0 && local<0.5 { c.saveGState();c.setAlpha(CGFloat(1-smooth(local/0.5)));drawScene(c,index-1,7.99);c.restoreGState() }
    c.saveGState();c.setAlpha(CGFloat(index==0 ? 1:smooth(local/0.5)));drawScene(c,index,local);c.restoreGState()
    text(c,"caspy",47,23,31,190,50,ink,.bold);text(c,".",138,21,35,40,50,orange,.bold)
    text(c,"A LITTLE CHARM. A LITTLE MISCHIEF.",228,38,12,700,28,muted,.semibold)
    pill(c,"DEMO EXPLAINER  ·  \(index+1)/7",1100,25,290,lavender,purple)
    c.setFillColor(color(.white,0.96));c.fill(rect(0,704,W,106))
    c.setFillColor(lavender.cgColor);c.fill(rect(0,704,W,1))
    text(c,scenes[index].caption,50,730,26,1340,65,ink,.semibold,1,.center)
    c.setFillColor(lavender.cgColor);c.fill(rect(0,805,W,5));c.setFillColor(orange.cgColor);c.fill(rect(0,805,W*CGFloat(time/duration),5))
    return buffer
}
func saveJPEG(_ buffer:CVPixelBuffer,_ name:String) {
    let image=CIImage(cvPixelBuffer:buffer),cg=CIContext().createCGImage(image,from:image.extent)!
    let destination=CGImageDestinationCreateWithURL(output.appendingPathComponent(name) as CFURL,"public.jpeg" as CFString,1,nil)!
    CGImageDestinationAddImage(destination,cg,[kCGImageDestinationLossyCompressionQuality:0.9] as CFDictionary);CGImageDestinationFinalize(destination)
}
for i in 0..<7 { saveJPEG(renderFrame(Double(i)*8+3),"preview-\(i).jpg") }
saveJPEG(renderFrame(2.2),"caspy-walkthrough-poster.jpg")
print("Rendered seven preview scenes.");fflush(stdout)
if !args.contains("--stills") {
    let silent=output.appendingPathComponent("motion-silent.mp4")
    let final=output.appendingPathComponent("caspy-walkthrough.mp4")
    for path in [silent,final] where FileManager.default.fileExists(atPath:path.path) { try FileManager.default.removeItem(at:path) }
    let writer=try AVAssetWriter(outputURL:silent,fileType:.mp4);writer.shouldOptimizeForNetworkUse=true
    let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:Int(W),AVVideoHeightKey:Int(H),AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:2_400_000,AVVideoExpectedSourceFrameRateKey:fps,AVVideoMaxKeyFrameIntervalKey:fps*2,AVVideoProfileLevelKey:AVVideoProfileLevelH264MainAutoLevel]])
    input.expectsMediaDataInRealTime=false
    let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:Int(W),kCVPixelBufferHeightKey as String:Int(H)])
    writer.add(input);guard writer.startWriting() else { fatalError("Could not start native encoder; run with media access") };writer.startSession(atSourceTime:.zero)
    let total=Int(duration*Double(fps))
    for frame in 0..<total {
        autoreleasepool {
            while !input.isReadyForMoreMediaData { if writer.status == .failed { fatalError("Video encoding failed") };Thread.sleep(forTimeInterval:0.003) }
            let buffer=renderFrame(Double(frame)/Double(fps))
            guard adaptor.append(buffer,withPresentationTime:CMTime(value:Int64(frame),timescale:fps)) else { fatalError("Frame append failed") }
        }
        if frame % (Int(fps)*8) == 0 { print("Encoded scene \(frame/(Int(fps)*8)+1)/7");fflush(stdout) }
    }
    input.markAsFinished();writer.endSession(atSourceTime:CMTime(seconds:duration,preferredTimescale:600))
    let done=DispatchSemaphore(value:0);writer.finishWriting { done.signal() };done.wait();guard writer.status == .completed else { fatalError("Could not finish video") }
    let composition=AVMutableComposition()
    let source=AVURLAsset(url:silent)
    let video=composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!
    try video.insertTimeRange(CMTimeRange(start:.zero,duration:CMTime(seconds:duration,preferredTimescale:600)),of:source.tracks(withMediaType:.video)[0],at:.zero)
    let soundtrackURL=URL(fileURLWithPath:args[1]).deletingLastPathComponent().appendingPathComponent("soundtrack.m4a")
    let soundtrack=AVURLAsset(url:soundtrackURL)
    let audio=composition.addMutableTrack(withMediaType:.audio,preferredTrackID:kCMPersistentTrackID_Invalid)!
    try audio.insertTimeRange(CMTimeRange(start:.zero,duration:CMTime(seconds:duration,preferredTimescale:600)),of:soundtrack.tracks(withMediaType:.audio)[0],at:.zero)
    let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetPassthrough)!
    export.outputURL=final;export.outputFileType = .mp4;export.shouldOptimizeForNetworkUse=true
    let muxed=DispatchSemaphore(value:0);export.exportAsynchronously { muxed.signal() };muxed.wait()
    guard export.status == .completed else { fatalError("Audio/video mux failed: \(String(describing:export.error))") }
    var captions="WEBVTT\n\n"
    for (i,scene) in scenes.enumerated() {
        captions += "\(i+1)\n00:\(String(format:"%02d",(i*8)/60)):\(String(format:"%02d",(i*8)%60)).000 --> 00:\(String(format:"%02d",((i+1)*8)/60)):\(String(format:"%02d",((i+1)*8)%60)).000\n\(scene.caption)\n\n"
    }
    try captions.write(to:output.appendingPathComponent("caspy-walkthrough.en.vtt"),atomically:true,encoding:.utf8)
    let size=(try FileManager.default.attributesOfItem(atPath:final.path)[.size] as! NSNumber).intValue
    print("Exported text-led 56-second motion video: \(size) bytes, 1440x810, 24 fps.")
}
