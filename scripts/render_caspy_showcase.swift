// Render Caspy's kinetic typography walkthrough. Native vector animation,
// illustrative UI, and a supplied original music/wordless-choir WAV; no narration.
// Usage: executable storyboard.json character.png soundtrack.wav output-dir [--candy image.png] [--stills]
import AppKit
import AVFoundation
import ImageIO

struct Scene: Decodable {
    let id: String; let seconds: Int; let label: String; let kicker: String
    let headline: String; let body: String; let tip: String; let action: String; let href: String
}
let args = CommandLine.arguments
guard args.count >= 5 else { fatalError("Expected storyboard, character, soundtrack and output paths") }
let scenes = try JSONDecoder().decode([Scene].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let output = URL(fileURLWithPath: args[4], isDirectory: true)
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
let W: CGFloat = 1600, H: CGFloat = 900
let fps: Int32 = 30
let duration = Double(scenes.reduce(0) { $0 + $1.seconds })
let starts = scenes.indices.map { Double(scenes.prefix($0).reduce(0) { $0 + $1.seconds }) }
let ink = NSColor(srgbRed:0.105,green:0.067,blue:0.17,alpha:1)
let dark = NSColor(srgbRed:0.16,green:0.095,blue:0.235,alpha:1)
let purple = NSColor(srgbRed:0.49,green:0.31,blue:0.66,alpha:1)
let lilac = NSColor(srgbRed:0.79,green:0.67,blue:0.94,alpha:1)
let lavender = NSColor(srgbRed:0.93,green:0.885,blue:0.975,alpha:1)
let cream = NSColor(srgbRed:0.985,green:0.96,blue:0.91,alpha:1)
let orange = NSColor(srgbRed:1,green:0.58,blue:0.33,alpha:1)
let muted = NSColor(srgbRed:0.79,green:0.73,blue:0.85,alpha:1)
let green = NSColor(srgbRed:0.73,green:0.86,blue:0.60,alpha:1)
func r(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat)->CGRect { CGRect(x:x,y:H-y-h,width:w,height:h) }
func clamp(_ v:Double)->Double { min(1,max(0,v)) }
func ease(_ v:Double)->Double { 1-pow(1-clamp(v),3) }
func smooth(_ v:Double)->Double { let t=clamp(v); return t*t*(3-2*t) }
func cg(_ color:NSColor,_ alpha:Double=1)->CGColor { color.withAlphaComponent(CGFloat(alpha)).cgColor }
func box(_ c:CGContext,_ rect:CGRect,_ color:NSColor,_ radius:CGFloat=24,_ alpha:Double=1) {
    c.setFillColor(cg(color,alpha)); c.addPath(CGPath(roundedRect:rect,cornerWidth:radius,cornerHeight:radius,transform:nil)); c.fillPath()
}
func stroke(_ c:CGContext,_ rect:CGRect,_ color:NSColor,_ width:CGFloat=2,_ radius:CGFloat=24,_ alpha:Double=1) {
    c.setStrokeColor(cg(color,alpha)); c.setLineWidth(width); c.addPath(CGPath(roundedRect:rect,cornerWidth:radius,cornerHeight:radius,transform:nil)); c.strokePath()
}
func txt(_ c:CGContext,_ value:String,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ width:CGFloat,_ height:CGFloat,_ shade:NSColor=cream,_ weight:NSFont.Weight = .regular,_ align:NSTextAlignment = .left,_ alpha:Double=1,_ tracking:CGFloat=0) {
    let style=NSMutableParagraphStyle(); style.lineSpacing=6; style.alignment=align; style.lineBreakMode = .byWordWrapping
    let font=NSFont.systemFont(ofSize:size,weight:weight)
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current=NSGraphicsContext(cgContext:c,flipped:false)
    NSAttributedString(string:value,attributes:[.font:font,.foregroundColor:shade.withAlphaComponent(CGFloat(alpha)),.paragraphStyle:style,.kern:tracking]).draw(in:r(x,y,width,height))
    NSGraphicsContext.restoreGraphicsState()
}
func pop(_ c:CGContext,_ area:CGRect,_ t:Double,_ delay:Double=0,_ draw:()->Void) {
    guard t>delay else { return }
    let elapsed=t-delay, p=1-exp(-7*elapsed)*cos(9*elapsed), scale=CGFloat(0.94+0.06*p)
    c.saveGState(); c.setAlpha(CGFloat(ease(elapsed/0.35)))
    c.translateBy(x:area.midX,y:area.midY-CGFloat(28*(1-p))); c.scaleBy(x:scale,y:scale); c.translateBy(x:-area.midX,y:-area.midY)
    draw(); c.restoreGState()
}
func pill(_ c:CGContext,_ title:String,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat,_ fill:NSColor=purple,_ shade:NSColor=cream) {
    box(c,r(x,y,width,43),fill,22); txt(c,title,x+17,y+11,17,width-34,28,shade,.semibold)
}
func star(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ radius:CGFloat,_ phase:Double,_ alpha:Double=1) {
    let s=radius*CGFloat(0.78+0.22*sin(phase)); let p=CGMutablePath()
    p.move(to:CGPoint(x:x,y:H-y+s)); p.addQuadCurve(to:CGPoint(x:x+s,y:H-y),control:CGPoint(x:x+s*0.2,y:H-y+s*0.2));p.addQuadCurve(to:CGPoint(x:x,y:H-y-s),control:CGPoint(x:x+s*0.2,y:H-y-s*0.2));p.addQuadCurve(to:CGPoint(x:x-s,y:H-y),control:CGPoint(x:x-s*0.2,y:H-y-s*0.2));p.addQuadCurve(to:CGPoint(x:x,y:H-y+s),control:CGPoint(x:x-s*0.2,y:H-y+s*0.2))
    c.setFillColor(cg(lilac,alpha));c.addPath(p);c.fillPath()
}
func candy(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ size:CGFloat,_ phase:Double,_ color:NSColor=orange) {
    c.saveGState(); c.translateBy(x:x,y:H-y);c.rotate(by:CGFloat(sin(phase)*0.4));c.setFillColor(color.cgColor)
    c.addPath(CGPath(roundedRect:CGRect(x:-size*0.5,y:-size*0.28,width:size,height:size*0.56),cornerWidth:8,cornerHeight:8,transform:nil));c.fillPath()
    for d:CGFloat in [-1,1] { c.move(to:CGPoint(x:d*size*0.48,y:0));c.addLine(to:CGPoint(x:d*size*0.9,y:size*0.32));c.addLine(to:CGPoint(x:d*size*0.9,y:-size*0.32));c.closePath();c.fillPath() }
    c.restoreGState()
}
func bat(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ s:CGFloat,_ t:Double) {
    c.saveGState();c.translateBy(x:x,y:H-y);let flap=CGFloat(sin(t*4))*s*0.13;c.setFillColor(cg(ink,0.7))
    let p=CGMutablePath();p.move(to:CGPoint(x:0,y:-s*0.2));p.addLine(to:CGPoint(x:-s*0.52,y:flap));p.addLine(to:CGPoint(x:-s,y:s*0.45+flap));p.addLine(to:CGPoint(x:-s*0.7,y:-s*0.35));p.addLine(to:CGPoint(x:-s*0.2,y:-s*0.32));p.addLine(to:CGPoint(x:0,y:-s*0.6));p.addLine(to:CGPoint(x:s*0.2,y:-s*0.32));p.addLine(to:CGPoint(x:s*0.7,y:-s*0.35));p.addLine(to:CGPoint(x:s,y:s*0.45+flap));p.addLine(to:CGPoint(x:s*0.52,y:flap));p.closeSubpath();c.addPath(p);c.fillPath();c.restoreGState()
}
func trim(_ image:CGImage)->CGImage {
    let w=image.width,h=image.height;var bytes=[UInt8](repeating:0,count:w*h*4)
    let ctx=CGContext(data:&bytes,width:w,height:h,bitsPerComponent:8,bytesPerRow:w*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(image,in:CGRect(x:0,y:0,width:w,height:h));var l=w,rr=0,top=h,b=0
    for y in 0..<h { for x in 0..<w where bytes[(y*w+x)*4+3]>25 { l=min(l,x);rr=max(rr,x);top=min(top,y);b=max(b,y) } }
    return image.cropping(to:CGRect(x:max(0,l-6),y:max(0,top-6),width:min(w-l,rr-l+13),height:min(h-top,b-top+13))) ?? image
}
let character=trim(CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(URL(fileURLWithPath:args[2]) as CFURL,nil)!,0,nil)!)
let candyArtwork: CGImage? = {
    guard let index=args.firstIndex(of:"--candy"), index+1<args.count else { return nil }
    guard let source=CGImageSourceCreateWithURL(URL(fileURLWithPath:args[index+1]) as CFURL,nil),
          let image=CGImageSourceCreateImageAtIndex(source,0,nil) else { fatalError("Candy preview cannot be decoded") }
    return image
}()
func caspy(_ c:CGContext,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat,_ height:CGFloat,_ t:Double) {
    let scale=min(width/CGFloat(character.width),height/CGFloat(character.height));let bob=CGFloat(sin(t*1.65))*13
    c.saveGState();c.translateBy(x:x+width/2,y:H-y-height/2+bob);c.rotate(by:CGFloat(sin(t*0.85))*0.035);c.setShadow(offset:CGSize(width:0,height:-12),blur:35,color:cg(ink,0.25));c.draw(character,in:CGRect(x:-CGFloat(character.width)*scale/2,y:-CGFloat(character.height)*scale/2,width:CGFloat(character.width)*scale,height:CGFloat(character.height)*scale));c.restoreGState()
}
func headline(_ c:CGContext,_ value:String,_ t:Double,_ x:CGFloat=75,_ y:CGFloat=200,_ size:CGFloat=76,_ width:CGFloat=1050) {
    for (i,line) in value.components(separatedBy:"\n").enumerated() {
        let delay=0.28+Double(i)*0.22, dy=y+CGFloat(i)*(size+13)
        pop(c,r(x,dy,width,size+20),t,delay) {
            c.saveGState(); c.clip(to:r(x,dy,width*CGFloat(ease((t-delay)/0.65)),size+25))
            txt(c,line,x,dy,size,width,size+25,i==1 ? orange:cream,.heavy)
            c.restoreGState()
        }
        if i==1 && t>1.05 { let progress=CGFloat(ease((t-1.05)/0.8));box(c,r(x,dy+size+8,min(width*0.8,650)*progress,5),orange,2,0.55) }
    }
}
func field(_ c:CGContext,_ label:String,_ value:String,_ x:CGFloat,_ y:CGFloat,_ width:CGFloat,_ t:Double,_ delay:Double) {
    pop(c,r(x,y,width,85),t,delay) { txt(c,label,x,y,19,width,28,muted,.medium);box(c,r(x,y+33,width,51),dark,10);stroke(c,r(x,y+33,width,51),lilac,1,10,0.3);txt(c,value,x+17,y+47,21,width-34,31,cream,.medium) }
}
func check(_ c:CGContext,_ title:String,_ y:CGFloat,_ t:Double,_ delay:Double,_ enabled:Bool=false) {
    pop(c,r(830,y,655,72),t,delay) { box(c,r(850,y+10,30,30),enabled ? green:dark,8);stroke(c,r(850,y+10,30,30),lilac,2,8,0.8);if enabled { txt(c,"✓",854,y+10,24,30,35,ink,.bold) };txt(c,title,900,y+9,23,550,70,cream,.medium) }
}
func bodyCard(_ c:CGContext,_ scene:Scene,_ t:Double,_ index:Int) {
    // Keep the reading surface steady after the staged entrance.
    let y:CGFloat=630
    pop(c,r(75,y,1450,158),t,1.0) {
        box(c,r(75,y,1450,158),cream,22)
        pill(c,String(format:"%02d",index+1),97,y+20,64,orange,ink)
        txt(c,scene.body,185,y+22,28,1305,88,ink,.medium)
        txt(c,scene.tip,185,y+111,19,1300,43,purple,.medium)
    }
}
func scene(_ c:CGContext,_ index:Int,_ t:Double) {
    let s=scenes[index]
    txt(c,s.kicker,78,131,17,1440,35,lilac,.semibold,.left,1,2.1)
    switch s.id {
    case "welcome","ready":
        headline(c,s.headline,t,75,214,79,1030)
        c.setFillColor(cg(purple,0.45));c.fillEllipse(in:r(1080,180,390,390));stroke(c,r(1030,135,480,480),lilac,1,235,0.22)
        pop(c,r(1050,160,450,450),t,0.2) { caspy(c,1075,160,415,440,t) }
        if s.id=="welcome" {
            for (i,title) in ["3 PROMPTS","WIN THE CANDY","NO LUCK DRAWS"].enumerated() { pop(c,r(CGFloat(78+i*252),465,232,43),t,1.2+Double(i)*0.15) { pill(c,title,CGFloat(78+i*252),465,232,dark,lilac) } }
        } else { pop(c,r(80,469,600,62),t,0.9) { box(c,r(80,469,590,62),orange,14);txt(c,"REGISTER  →  PLAY  →  EXPLORE",104,489,22,550,35,ink,.bold) } }
    case "account":
        headline(c,s.headline,t,75,208,76,740);caspy(c,390,396,190,200,t)
        pop(c,r(820,192,690,408),t,0.15) { box(c,r(820,192,690,408),dark,25);stroke(c,r(820,192,690,408),lilac,1,25,0.3);txt(c,"JOIN THE HAUNT",850,215,23,600,40,cream,.bold) }
        field(c,"YOUR NAME","Little heister",855,276,615,t,0.6)
        field(c,"EMAIL","you@example.com",855,375,615,t,0.85)
        pop(c,r(855,478,615,84),t,1.15) { txt(c,"PASSWORD",855,478,19,400,28,muted,.medium);box(c,r(855,511,615,51),purple,10);txt(c,"12+ characters · confirm it",874,525,22,570,32,cream,.semibold) }
    case "consent":
        headline(c,s.headline,t,75,218,80,740)
        pop(c,r(815,209,700,380),t,0.2) { box(c,r(815,209,700,380),dark,25);stroke(c,r(815,209,700,380),lilac,1,25,0.3);pill(c,"PRIVATE BY DEFAULT",850,236,450,purple,cream) }
        check(c,"Choose a named research campaign",312,t,0.8)
        check(c,"Opt in to research contribution",395,t,1.2)
        check(c,"Commercial permission is separate",478,t,1.6)
        pop(c,r(78,469,650,65),t,2.1) { pill(c,"SAY NO. STILL PLAY. STILL EARN.",78,469,620,orange,ink) }
    case "prompt":
        headline(c,s.headline,t,75,197,72,1350)
        let prompt="I’ll bake moonbeam cookies for every lonely ghost. Could one candy decorate our first batch?"
        pop(c,r(78,397,1435,182),t,0.75) { box(c,r(78,397,1435,182),lavender,24);txt(c,"YOUR PITCH",108,417,17,1100,30,purple,.bold,.left,1,1.5);let count=Int(clamp((t-1.0)/2.8)*Double(prompt.count));txt(c,String(prompt.prefix(count)),108,461,32,1310,105,ink,.semibold);txt(c,"500 CHARACTERS MAX  ·  ENTER TO SEND",108,550,14,1100,25,purple,.semibold) }
        if t>4 { for i in 0..<9 { let p=t-4+Double(i)*0.2;star(c,CGFloat(200+i*150),370+CGFloat(sin(p))*15,8,p,0.55) } }
    case "attempts":
        headline(c,s.headline,t,75,194,72,1400)
        for i in 0..<3 {
            let x=CGFloat(82+i*485), used=t>Double(i)*2.2+2.0
            pop(c,r(x,405,455,174),t,0.8+Double(i)*0.2) { box(c,r(x,405,455,174),used ? purple:dark,22);stroke(c,r(x,405,455,174),used ? lilac:purple,2,22,0.6);candy(c,x+65,468,39,t+Double(i),used ? lilac:orange);txt(c,["A thoughtful trade","A different angle","One last story"][i],x+120,438,25,315,75,cream,.bold);txt(c,used ? "PROMPT SENT  ✓":"CHANCE \(i+1)",x+120,526,17,305,28,used ? lavender:muted,.semibold) }
        }
    case "judge":
        headline(c,s.headline,t,75,192,70,1400)
        let cards=[("CASPY", "A character response", orange), ("INDEPENDENT JUDGE", "Structured evaluation", lilac), ("SERVER", "Confirms the outcome", green)]
        for (i,item) in cards.enumerated() {
            let x=CGFloat(80+i*486)
            pop(c,r(x,401,452,177),t,0.8+Double(i)*0.3) { box(c,r(x,401,452,177),dark,22);box(c,r(x+25,429,7,110),item.2,3);txt(c,item.0,x+50,438,22,370,40,item.2,.bold);txt(c,item.1,x+50,497,24,365,65,cream,.medium) }
            if i<2 {
                let a=CGFloat(ease((t-1.4-Double(i)*0.3)/0.7));box(c,r(x+455,485,31*a,3),orange,1)
                if t>2 { let phase=CGFloat((t*0.65-Double(i)*0.25).truncatingRemainder(dividingBy:1));box(c,r(x+453+phase*28,481,9,9),orange,4) }
            }
        }
    case "result":
        headline(c,s.headline,t,75,197,73,1400)
        for i in 0..<2 {
            let x=CGFloat(80+i*743), float=CGFloat(sin(t*1.6+Double(i)))*6
            pop(c,r(x,402,710,183),t,0.8+Double(i)*0.3) { box(c,r(x,402+float,710,183),i==0 ? orange:lavender,23);txt(c,i==0 ? "WIN → CANDY":"LOSS → NO CANDY",x+30,426+float,43,650,75,ink,.heavy);txt(c,i==0 ? "C / B / A / S — scored, never drawn.":"No reward image. No NFT.",x+33,520+float,24,640,45,ink,.medium) }
        }
    case "mint":
        headline(c,s.headline,t,75,201,76,880)
        pop(c,r(1110,195,380,410),t,1.1) {
            let bob=CGFloat(sin(t*1.6))*7
            box(c,r(1110,195+bob,380,370),lavender,24)
            if let art=candyArtwork { c.saveGState();c.addPath(CGPath(roundedRect:r(1120,205+bob,360,350),cornerWidth:18,cornerHeight:18,transform:nil));c.clip();c.draw(art,in:r(1120,200+bob,360,360));c.restoreGState() }
            else { candy(c,1300,380+bob,120,t) }
            txt(c,"ILLUSTRATIVE CANDY · NOT A MINT",1110,579,14,380,28,lilac,.semibold,.center)
        }
        let items=["01  WIN → APPROVE FLUX ARTWORK","02  YOUR PROMPT → FLAVOR, COLOR, WRAPPER","03  MINT → OPEN YOUR COLLECTION"]
        for (i,title) in items.enumerated() { pop(c,r(78,CGFloat(430+i*50),980,39),t,0.9+Double(i)*0.65) { txt(c,title,78,CGFloat(430+i*50),21,980,37,i==2 && t>4 ? green:cream,.semibold) } }
    case "research":
        headline(c,s.headline,t,75,198,74,1400)
        for (i,title) in ["COLLECT YOUR CANDY","LICENSE & LIST","BUYER UNLOCKS PROMPT"].enumerated() {
            let x=CGFloat(80+i*486)
            pop(c,r(x,409,452,175),t,0.8+Double(i)*0.3) { box(c,r(x,409,452,175),dark,22);txt(c,"0\(i+1)",x+24,428,42,110,65,orange,.heavy);txt(c,title,x+25,518,22,405,45,cream,.bold) }
        }
    default: break
    }
    bodyCard(c,s,t,index)
}
func frame(_ time:Double)->CVPixelBuffer {
    var optional:CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault,Int(W),Int(H),kCVPixelFormatType_32ARGB,[kCVPixelBufferCGImageCompatibilityKey:true,kCVPixelBufferCGBitmapContextCompatibilityKey:true] as CFDictionary,&optional)
    let buffer=optional!;CVPixelBufferLockBaseAddress(buffer,[]);defer { CVPixelBufferUnlockBaseAddress(buffer,[]) }
    let c=CGContext(data:CVPixelBufferGetBaseAddress(buffer),width:Int(W),height:Int(H),bitsPerComponent:8,bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipFirst.rawValue)!
    c.setFillColor(ink.cgColor);c.fill(CGRect(x:0,y:0,width:W,height:H))
    let gradient=CGGradient(colorsSpace:CGColorSpaceCreateDeviceRGB(),colors:[cg(dark),cg(ink)] as CFArray,locations:[0,1])!
    c.drawLinearGradient(gradient,start:CGPoint(x:0,y:H),end:CGPoint(x:W,y:0),options:[])
    // Slow parallax, a breathing moon, drifting stars, and bat silhouettes.
    c.setFillColor(cg(purple,0.09));c.fillEllipse(in:r(1100+CGFloat(sin(time*0.12))*45,-240,700,700))
    c.setStrokeColor(cg(lilac,0.045));c.setLineWidth(1)
    for i in 0..<18 { let x=CGFloat(i)*100+CGFloat(time.truncatingRemainder(dividingBy:8))*4;c.move(to:CGPoint(x:x,y:0));c.addLine(to:CGPoint(x:x,y:H)) };c.strokePath()
    for i in 0..<22 { star(c,CGFloat(30+i*73),90+CGFloat((i*67)%500)+CGFloat(sin(time*0.5+Double(i)))*13,CGFloat(3+i%3),time+Double(i),0.18) }
    bat(c,1450+CGFloat(sin(time*0.22))*35,148,23,time);bat(c,1320+CGFloat(sin(time*0.17))*50,114,14,time+2)
    let index=starts.indices.last(where:{time>=starts[$0]}) ?? 0, local=time-starts[index]
    if index>0 && local<0.42 { c.saveGState();c.setAlpha(CGFloat(1-smooth(local/0.42)));c.translateBy(x:-CGFloat(ease(local/0.42))*55,y:0);scene(c,index-1,Double(scenes[index-1].seconds)-0.01);c.restoreGState() }
    c.saveGState();c.setAlpha(CGFloat(index==0 ? 1:smooth(local/0.42)));c.translateBy(x:CGFloat(1-ease(local/0.55))*65,y:0);scene(c,index,local);c.restoreGState()
    txt(c,"caspy.",73,31,38,230,58,cream,.heavy)
    txt(c,"THE INTERACTIVE FIELD GUIDE",290,48,14,800,28,muted,.semibold,.left,1,2)
    pill(c,String(format:"%02d / %02d",index+1,scenes.count),1353,34,173,dark,lilac)
    txt(c,String(format:"%02d",index+1),1250,690,128,270,160,lilac,.heavy,.right,0.045)
    for i in scenes.indices {
        let x=CGFloat(78+i*146),progress=i<index ? 1:i==index ? clamp(local/Double(scenes[i].seconds)):0
        box(c,r(x,831,132,5),lilac,2,0.20);box(c,r(x,831,132*CGFloat(progress),5),orange,2)
    }
    txt(c,scenes[index].label.uppercased(),78,856,13,1100,24,muted,.medium,.left,1,1.4)
    txt(c,"MUSIC + WORDLESS GHOST CHOIR · NO NARRATION",910,856,12,615,24,muted,.medium,.right)
    return buffer
}
func jpeg(_ buffer:CVPixelBuffer,_ name:String) {
    let image=CIImage(cvPixelBuffer:buffer),cgImage=CIContext().createCGImage(image,from:image.extent)!
    let destination=CGImageDestinationCreateWithURL(output.appendingPathComponent(name) as CFURL,"public.jpeg" as CFString,1,nil)!
    CGImageDestinationAddImage(destination,cgImage,[kCGImageDestinationLossyCompressionQuality:0.93] as CFDictionary);CGImageDestinationFinalize(destination)
}
for i in scenes.indices { jpeg(frame(starts[i]+min(4.5,Double(scenes[i].seconds)-1)),"preview-\(i).jpg") }
jpeg(frame(3),"caspy-showcase-poster.jpg")
print("Rendered \(scenes.count) scene previews.");fflush(stdout)
func stamp(_ seconds:Double)->String { let ms=Int(seconds*1000);return String(format:"%02d:%02d:%02d.%03d",ms/3600000,(ms/60000)%60,(ms/1000)%60,ms%1000) }
var captions="WEBVTT\n\n"
for (i,s) in scenes.enumerated() {
    captions += "\(i+1)\n\(stamp(starts[i])) --> \(stamp(starts[i]+Double(s.seconds)))\n\(i == 0 ? "[Halloween music and wordless ghost choir; no spoken narration]\n" : "")\(s.label). \(s.body)\n\(s.tip)\n\n"
}
try captions.write(to:output.appendingPathComponent("caspy-showcase.en.vtt"),atomically:true,encoding:.utf8)
if !args.contains("--stills") {
    let silent=output.appendingPathComponent("motion-silent.mp4"), final=output.appendingPathComponent("caspy-showcase.mp4")
    for path in [silent,final] where FileManager.default.fileExists(atPath:path.path) { try FileManager.default.removeItem(at:path) }
    let writer=try AVAssetWriter(outputURL:silent,fileType:.mp4);writer.shouldOptimizeForNetworkUse=true
    let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:Int(W),AVVideoHeightKey:Int(H),AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:2_800_000,AVVideoExpectedSourceFrameRateKey:fps,AVVideoMaxKeyFrameIntervalKey:fps*2,AVVideoProfileLevelKey:AVVideoProfileLevelH264HighAutoLevel]])
    input.expectsMediaDataInRealTime=false
    let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32ARGB,kCVPixelBufferWidthKey as String:Int(W),kCVPixelBufferHeightKey as String:Int(H)])
    writer.add(input);guard writer.startWriting() else { fatalError("Could not start encoder: \(String(describing:writer.error))") };writer.startSession(atSourceTime:.zero)
    for n in 0..<Int(duration*Double(fps)) {
        autoreleasepool {
            while !input.isReadyForMoreMediaData { if writer.status == .failed { fatalError("Encoder failed") };Thread.sleep(forTimeInterval:0.003) }
            guard adaptor.append(frame(Double(n)/Double(fps)),withPresentationTime:CMTime(value:Int64(n),timescale:fps)) else { fatalError("Frame append failed") }
        }
        if n % (Int(fps)*10)==0 { print("Rendered \(n/Int(fps)) / \(Int(duration)) seconds");fflush(stdout) }
    }
    input.markAsFinished();writer.endSession(atSourceTime:CMTime(seconds:duration,preferredTimescale:600))
    let done=DispatchSemaphore(value:0);writer.finishWriting { done.signal() };done.wait();guard writer.status == .completed else { fatalError("Video encoding failed") }
    // Encode the original PCM score to AAC once, then copy H.264 + AAC into MP4.
    let audioURL=output.appendingPathComponent("soundtrack.m4a")
    if FileManager.default.fileExists(atPath:audioURL.path) { try FileManager.default.removeItem(at:audioURL) }
    let audioSource=AVURLAsset(url:URL(fileURLWithPath:args[3]))
    let audioExport=AVAssetExportSession(asset:audioSource,presetName:AVAssetExportPresetAppleM4A)!
    audioExport.outputURL=audioURL;audioExport.outputFileType = .m4a
    let audioDone=DispatchSemaphore(value:0);audioExport.exportAsynchronously { audioDone.signal() };audioDone.wait()
    guard audioExport.status == .completed else { fatalError("AAC encoding failed") }
    let composition=AVMutableComposition(), source=AVURLAsset(url:silent), sound=AVURLAsset(url:audioURL)
    let range=CMTimeRange(start:.zero,duration:CMTime(seconds:duration,preferredTimescale:600))
    try composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid)!.insertTimeRange(range,of:source.tracks(withMediaType:.video)[0],at:.zero)
    guard let soundTrack=sound.tracks(withMediaType:.audio).first, sound.duration.seconds>=duration-0.05 else { fatalError("Soundtrack missing or too short") }
    try composition.addMutableTrack(withMediaType:.audio,preferredTrackID:kCMPersistentTrackID_Invalid)!.insertTimeRange(range,of:soundTrack,at:.zero)
    let export=AVAssetExportSession(asset:composition,presetName:AVAssetExportPresetPassthrough)!
    export.outputURL=final;export.outputFileType = .mp4;export.shouldOptimizeForNetworkUse=true
    let finished=DispatchSemaphore(value:0);export.exportAsynchronously { finished.signal() };finished.wait()
    guard export.status == .completed else { fatalError("Mux failed: \(String(describing:export.error))") }
    print("Exported \(Int(duration)) seconds, 1600x900, 30 fps, music only.")
}
