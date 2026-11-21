#!/usr/bin/env python3
"""Native pixel derivatives for El Pacto de Hiareth / art batch 3.

Run: tools/.venv/bin/python tools/gen_anim_sprites3.py
Writes only the five named strips, anim_sprites3.json and anim_preview3.png.
Follows gen_anim_sprites[2]: source masks, rigid NEAREST joints, sampled inks,
binary alpha, fixed-frame review, provenance and source integrity checks.

Art brief: right-facing Phaser sprites; unscaled 250px Aidan, y167 anchor;
two-ink violet ghost fire, red eyes; angular charcoal crust with amber fissures;
hard 1px orb outline, upper-left warm core. No blur, interpolated ink or AI art.
The existing project artwork supplies all pixels/inks and inherited licences.
Review at x2 on dark/light; cracks also tiled over a 32px platform mockup.
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/sprites'
NEAREST = Image.Resampling.NEAREST
HASHES, MANIFEST, PREVIEWS = {}, {}, []
OUTPUTS = ['aidan/JumpAttack.png', 'fx/orb.png', 'fx/orb_pickup.png',
           'fx/lava_trail.png', 'fx/platform_crack.png']


def canvas(w, h=None):
    return Image.new('RGBA', (w, w if h is None else h))


def frame(name, index=0, size=250, row=0):
    p = ASSETS / name
    HASHES[name] = hashlib.sha256(p.read_bytes()).hexdigest()
    with Image.open(p) as im:
        a = np.array(im.convert('RGBA').crop((index*size, row*size,
                                              (index+1)*size, (row+1)*size)))
    a[a[:, :, 3] != 255] = 0  # exclude slime shadow and hidden white matte
    return Image.fromarray(a)


def region(im, points):
    m = Image.new('L', im.size)
    ImageDraw.Draw(m).polygon(points, fill=255)
    a = np.array(im)
    a[np.asarray(m) == 0] = 0
    return Image.fromarray(a)


def joint(dest, part, pivot, target, angle):
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    px, py = pivot
    tx, ty = target
    dest.alpha_composite(part.transform(dest.size, Image.Transform.AFFINE,
        (c, -s, px-c*tx+s*ty, s, c, py-s*tx-c*ty), resample=NEAREST))


def islands(im):
    a = np.array(im)
    mask = a[:, :, 3] > 0
    seen, pieces = set(), []
    for y, x in zip(*np.where(mask)):
        if (x, y) in seen:
            continue
        todo, pts = [(int(x), int(y))], []
        seen.add((x, y))
        while todo:
            xx, yy = todo.pop()
            pts.append((xx, yy))
            for nx, ny in [(xx-1, yy), (xx+1, yy), (xx, yy-1), (xx, yy+1)]:
                if 0 <= nx < im.width and 0 <= ny < im.height and mask[ny, nx] and (nx, ny) not in seen:
                    seen.add((nx, ny))
                    todo.append((nx, ny))
        layer = np.zeros_like(a)
        xs, ys = zip(*pts)
        layer[ys, xs] = a[ys, xs]
        pieces.append((len(pts), Image.fromarray(layer)))
    return [p for _, p in sorted(pieces, key=lambda pair: -pair[0])]


JUMP = frame('aidan/Jump.png')
FALL = frame('aidan/Fall.png')
IDLE = frame('aidan/Idle.png')
ATTACK = frame('aidan/Attack2.png', 5)
GHOST = frame('fx/ghostfire.png', size=48)
SLIMES = [frame('slime/Slime3_Idle_with_shadow.png', i, 64, 3) for i in range(6)]
WALK = [frame('slime/Slime3_Walk_with_shadow.png', i, 64, 3) for i in range(8)]


def ink(target, sources=SLIMES):
    colours = Counter(p for im in sources for p in im.get_flattened_data() if p[3] == 255)
    return min(colours, key=lambda p: (sum((p[k]-target[k])**2 for k in range(3)), -colours[p]))


COAL = ink((28, 21, 22))
UMBER = ink((51, 37, 38))
ROCK = ink((65, 48, 47))
RUST = ink((91, 40, 33))
COPPER = ink((169, 87, 56))
ORANGE = ink((194, 114, 54))
AMBER = ink((220, 147, 52))
GOLD = ink((237, 170, 51))
YELLOW = ink((253, 211, 76))
CREAM = ink((255, 245, 172))
HOT = ink((255, 255, 140))
DUST = ink((138, 118, 102))
VIOLET = ink((77, 12, 79), [GHOST])


def jump_attack():
    # Native folded robe, hood, torso and rear sleeve; no standing Attack legs.
    body = region(JUMP, [(110,124),(120,116),(129,116),(132,124),
        (130,129),(133,135),(134,140),(143,141),(143,156),(129,164),
        (108,167),(102,167),(105,153),(112,144),(114,134),(108,137),(107,131)])
    arm = region(JUMP, [(128,129),(135,129),(139,125),(139,121),
        (145,121),(146,125),(143,131),(139,134),(130,134)])
    staff = region(JUMP, [(85,80),(136,80),(136,108),(162,136),
        (162,141),(133,113),(117,128),(85,128)])
    # The flame overlaps the hood in the source: mask by native material inks
    # as well as geometry so no detached face, embroidery or sleeve travels.
    staff_inks = {p for p in GHOST.get_flattened_data() if p[3]==255}
    staff_inks.update(p for p in JUMP.crop((90,80,135,114)).get_flattened_data() if p[3]==255)
    staff_inks.update({(40,9,22,255),(59,14,32,255),(59,15,33,255),
                      (101,37,62,255),(47,28,36,255),(32,18,28,255)})
    a=np.array(staff)
    for y,x in zip(*np.where(a[:,:,3])):
        if tuple(a[y,x]) not in staff_inks: a[y,x]=0
    staff=Image.fromarray(a)
    # Detached Attack2 crescent preserves its original scalloped flame clusters.
    source_arc = islands(ATTACK)[0]
    source_arc = source_arc.crop(source_arc.getbbox())
    result, bodies = [], []
    angles = [8, -35, -119, -142, -95, -22]
    arm_angles = [10, -4, -27, -33, -18, 0]
    for i in range(6):
        f = body.copy()
        bodies.append(body.copy())
        # The hand follows a shoulder pivot; the staff follows that SAME hand.
        angle = math.radians(arm_angles[i])
        hand = (round(131+math.cos(angle)*12+math.sin(angle)*-7),
                round(130-math.sin(angle)*12+math.cos(angle)*-7))
        joint(f, staff, (143,123), hand, angles[i])
        joint(f, arm, (131,130), (131,130), arm_angles[i])
        if i in (2, 3):
            arc = source_arc.resize((63 if i == 2 else 65, 48), NEAREST)
            f.alpha_composite(arc, (152 if i == 2 else 150, 99 if i == 2 else 102))
            # Ghostfire's native tail stitches the sweep to the staff head.
            tail = GHOST.crop((2,7,30,25)).resize((28,14), NEAREST)
            f.alpha_composite(tail, (149,117 if i == 2 else 126))
        if i == 4:
            for n, (x,y) in enumerate([(181,117),(194,130),(207,143)]):
                bit = region(GHOST.crop((4+n*6,8,11+n*6,16)),
                             [(0,0),(3,2),(5,1),(4,4),(6,5),(3,5),(2,7),(1,4)])
                f.alpha_composite(bit, (x,y))
        result.append(f)
    # Body centre / folded legs are byte-identical through the six-frame cycle.
    assert len({b.tobytes() for b in bodies}) == 1
    assert all(np.array_equal(np.array(f)[159:168,102:144],
                              np.array(result[0])[159:168,102:144]) for f in result)
    return result


ORB_PATTERN = [
    '.....OOOOOO.....', '...OODCCAADOO...',
    '..ODCAGYYGACDO..', '.ODCAYYLLLYGCDO.',
    '.OCAYLLLLLYGACO.', 'ODCAYLLHLLYGACDO',
    'OCAGYLLLLYGGAACO', 'OCAGYYLYYGGAACDO',
    'OCAGGYYGGGAACCDO', 'ODCAGGGGGAACCDDO',
    'ODCAAGGAACCCDDDO', '.ODCAAAACCCDDDO.',
    '.ODDCCCCCDDDDOO.', '..ODDDDDDDDDOO..',
    '...OODDDDDDOO...', '.....OOOOOO.....',
]


def orb_frames():
    palette = dict(O=COAL, D=RUST, C=COPPER, A=AMBER,
                   G=GOLD, Y=YELLOW, L=CREAM, H=HOT)
    result = []
    for i in range(6):
        f = canvas(20)
        for y, row in enumerate(ORB_PATTERN):
            assert len(row) == 16, (y, row)
            for x, code in enumerate(row):
                if code != '.':
                    f.putpixel((x+2,y+2), palette[code])
        # One-pixel contour, independent of the template's interior shading.
        original=f.copy()
        for y in range(2,18):
            for x in range(2,18):
                if not original.getpixel((x,y))[3]: continue
                edge=any(not original.getpixel((nx,ny))[3]
                         for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
                if edge: f.putpixel((x,y),COAL)
                elif f.getpixel((x,y))==COAL: f.putpixel((x,y),RUST)
        # A specular star circles the sphere, anchored sphere never bobs.
        sx,sy = [(8,4),(12,5),(15,8),(13,13),(7,14),(4,9)][i]
        d = ImageDraw.Draw(f)
        d.line((sx-1,sy,sx+1,sy), fill=CREAM)
        d.line((sx,sy-1,sx,sy+1), fill=YELLOW)
        d.point((sx,sy),fill=HOT)
        # Small source-ink facets pulse inside, preserving the dark contour.
        if i in (1,2,3):
            d.line([(8,8),(9,7),(11,8)],fill=HOT if i == 2 else CREAM)
        result.append(f)
    return result


def spark(dest, x, y, phase, length=3):
    d = ImageDraw.Draw(dest)
    d.line([(x-1,y+1),(x,y),(x+1,y-length)],fill=RUST,width=2)
    d.line([(x,y),(x+1,y-length+1)],fill=GOLD if phase%2 else YELLOW)
    d.point((x,y), fill=CREAM)


def pickup_frames():
    result = []
    for i,radius in enumerate([4,8,11,13,14]):
        f = canvas(32)
        d = ImageDraw.Draw(f)
        if i < 4:
            # Broken stepped ring: dark silhouette outside, warm two-ink edge.
            for k in range(12):
                if i >= 2 and (k+i)%3 == 0 or i == 3 and k%2 == 0:
                    continue
                pts = [(round(15.5+math.cos(a)*radius),
                        round(15.5+math.sin(a)*radius*.83))
                       for a in [(k+j/3)*math.tau/12 for j in range(4)]]
                d.line(pts, fill=RUST, width=3 if i < 2 else 2)
                d.line([(x,y-1) for x,y in pts],fill=GOLD if k%3 else YELLOW)
        if i == 0:
            for y,row in enumerate(['..YY..','.YLLY.','YLHHLY','YLHHLY','.YLLY.','..YY..']):
                for x,c in enumerate(row):
                    if c != '.': f.putpixel((13+x,13+y), {'Y':YELLOW,'L':CREAM,'H':HOT}[c])
        for k in range(7):
            a = k*math.tau/7+.2
            rr = [6,10,12,13,14][i]
            x,y=round(15.5+math.cos(a)*rr),round(15.5+math.sin(a)*rr*.86)
            if i != 4 or k%2 == 0:
                spark(f,x,y,k+i,3 if i in (1,2) else 1)
        result.append(f)
    return result


def lava_frames():
    result=[]
    for i in range(6):
        f=canvas(64,24)
        d=ImageDraw.Draw(f)
        # Broken charcoal rim: most lava pixels sit in the bottom six rows.
        rim=[(2,20),(5,18),(9,18),(12,16),(19,17),(24,16),
             (30,17),(35,16),(43,17),(49,16),(55,18),(59,18),
             (62,20),(59,22),(51,22),(46,23),(36,22),(30,23),
             (22,22),(15,23),(7,22)]
        d.polygon(rim,fill=COAL)
        # Source rock's irregular brown/amber facets create the cooling crust.
        rock=np.asarray(SLIMES[i])
        for y in range(18,22):
            for x in range(5,60):
                if f.getpixel((x,y))[3]:
                    p=tuple(rock[29+(y-18)*2,24+(x%15)])
                    if p[3]: f.putpixel((x,y),p)
        # Interconnected molten channels interrupt the dark crust, no flat fill.
        for k,path in enumerate([
            [(5,20),(11,19),(16,20),(24,19),(30,20),(37,19),(44,20),(52,19),(59,20)],
            [(15,18),(18,19),(21,19)], [(31,18),(33,19),(34,21)],
            [(43,18),(46,19),(49,18)]]):
            d=ImageDraw.Draw(f)
            d.line(path,fill=ORANGE,width=2)
            d.line([(x,y-1) for x,y in path],fill=GOLD if (i+k)%3 else YELLOW)
        # The slime's actual flame islands, unscaled: uneven tongues and embers.
        for k,x in enumerate([8,21,36,49]):
            src=SLIMES[(i+k*2)%6]
            flame=region(src,[(19,3),(34,3),(34,22),(28,27),(19,27)])
            # Colour-mask excludes rock facets at the bottom of the flame.
            a=np.array(flame)
            warm=(a[:,:,0]>160)&(a[:,:,1]>80)&(a[:,:,2]<190)
            a[~warm]=0
            fl=Image.fromarray(a)
            fl=fl.crop(fl.getbbox())
            # Compress neither source texture nor pixel grid; vary attachment.
            fl=fl.crop((0,max(0,fl.height-13),fl.width,fl.height))
            f.alpha_composite(fl,(x,18-fl.height))
            spark(f,x+3,6+(i+k*2)%5,i+k,1)
        result.append(f)
    return result


# Explicit connected paths; stage n strictly retains all preceding damage.
CRACK_PATHS = [
    [[(0,6),(4,6),(7,8),(11,7),(14,9),(17,9)],
     [(34,2),(32,5),(34,7),(31,10)], [(55,8),(59,7),(63,6)]],
    [[(17,9),(21,7),(24,8),(28,6),(32,5)],
     [(34,7),(40,8),(44,6),(48,7),(52,5),(55,8)],
     [(11,7),(10,4),(12,2)], [(44,6),(45,10),(48,12)]],
    [[(14,9),(16,12),(21,13),(23,15)],
     [(24,8),(26,11),(31,10),(36,12),(37,15)],
     [(52,5),(51,2),(54,0)], [(58,7),(57,11),(61,14)]],
    [[(4,6),(3,10),(6,12),(5,15)],
     [(21,7),(20,4),(23,2),(22,0)], [(40,8),(39,4),(42,1)],
     [(48,12),(51,13),(54,12),(57,11)], [(16,12),(12,13),(10,15)]],
]


def crack_frames():
    result=[]
    for stage in range(4):
        f=canvas(64,16)
        d=ImageDraw.Draw(f)
        for level in range(stage+1):
            for j,path in enumerate(CRACK_PATHS[level]):
                d.line([(x,y+1) for x,y in path],fill=ROCK,width=2 if stage>=2 else 1)
                d.line(path,fill=COAL,width=2 if stage==3 else 1)
                for x,y in path[1:-1]:
                    if (x+level+j)%3==0:
                        d.point((x+1,y+2),fill=DUST)
        for k in range(stage*4):
            x,y=(9+k*17)%62+1,(2+k*7)%14+1
            d.point((x,y),fill=ROCK if k%2 else DUST)
        # Exact wrap: continuation has matching y6 ink at both 64px tile edges.
        # All other edge rows stay transparent, including at the final stage.
        for y in range(16):
            for x in (0,63): f.putpixel((x,y),COAL if y==6 else (0,0,0,0))
        result.append(f)
    return result


def save(path, frames, sources, ref, crop, baseline, notes, labels):
    w,h=frames[0].size
    strip=canvas(w*len(frames),h)
    for i,f in enumerate(frames): strip.alpha_composite(f,(i*w,0))
    a=np.array(strip)
    a[a[:,:,3]==0]=0
    Image.fromarray(a).save(ASSETS/path,compress_level=9)
    MANIFEST[path]={'frameWidth':w,'frameHeight':h,'frames':len(frames),
        'source':{'kind':'deterministic-pixel-derivative','files':sources},
        'license':'Inherited from project source artwork; no external artwork added.',
        'baseline':baseline,'notes':notes,'technical_checks_passed':False}
    PREVIEWS.append((path,frames,ref,crop,baseline,labels))


def preview():
    font=ImageFont.load_default(size=14)
    title=ImageFont.load_default(size=18)
    panels=[]
    for path,frames,ref,crop,baseline,labels in PREVIEWS:
        cw,ch=(crop[2]-crop[0])*2,(crop[3]-crop[1])*2
        rv=ref if ref.size!=frames[0].size else ref.crop(crop)
        rw,rh=max(rv.width*2,88),rv.height*2
        cellw=max(cw,96); cellh=max(ch,rh,52)
        width=max(1060,rw+24+(cellw+12)*len(frames))
        p=Image.new('RGB',(width,78+2*(cellh+32)),'#252935')
        d=ImageDraw.Draw(p)
        d.text((12,8),path+'  /  ORIGINAL + ALL FRAMES',font=title,fill='#f1e1cd')
        d.text((12,35),f'{frames[0].width}x{frames[0].height} | x2 NEAREST | fixed crop {crop}',font=font,fill='#b7c1ce')
        for row,bg in enumerate(['#171c28','#e9e2ce']):
            yy=68+row*(cellh+32)
            for j,im in enumerate([rv]+[f.crop(crop) for f in frames]):
                xx=12 if j==0 else rw+24+(j-1)*(cellw+12)
                ww=rw if j==0 else cellw
                d.rectangle((xx,yy,xx+ww-1,yy+cellh-1),fill=bg)
                if baseline and path.startswith('aidan'):
                    gy=yy+(baseline-crop[1])*2
                    for gx in range(xx,xx+ww,12): d.line((gx,gy,gx+3,gy),fill='#927b6c')
                view=im.resize((im.width*2,im.height*2),NEAREST)
                p.paste(view,(xx+(ww-view.width)//2,yy+(cellh-view.height)//2),view)
                d.text((xx,yy+cellh+5),'SOURCE' if j==0 else f'{j-1} {labels[j-1]}',font=font,fill='#cad0dc')
        panels.append(p)
    # Transparent damage over a 32px platform, 3 repeats; mockup lives ONLY here.
    test=Image.new('RGB',(1060,225),'#252935');d=ImageDraw.Draw(test)
    d.text((12,8),'CRACK MOSAIC / 3 x 64px overlay / 32px-high platform / x2 NEAREST',font=title,fill='#f1e1cd')
    cracks=PREVIEWS[-1][1]
    for i in range(4):
        tile=Image.new('RGBA',(192,32),(83,63,59,255));td=ImageDraw.Draw(tile)
        td.rectangle((0,0,191,2),fill=(138,118,102,255))
        for xx in range(0,192,32):
            td.line((xx,3,xx,31),fill=(65,48,47,255))
        for xx in range(0,192,64):tile.alpha_composite(cracks[i],(xx,3))
        test.paste(tile.resize((384,64),NEAREST),(12+(i%2)*510,44+(i//2)*87))
        d.text((405+(i%2)*510,66+(i//2)*87),f'STAGE {i}',font=font,fill='#cad0dc')
    panels.append(test)
    out=Image.new('RGB',(max(p.width for p in panels),60+sum(p.height+12 for p in panels)),'#10141d')
    d=ImageDraw.Draw(out)
    d.text((12,10),'EL PACTO DE HIARETH / ART REVIEW 3 / NATIVE SOURCE INKS',font=title,fill='#f1e1cd')
    d.text((12,34),'Dark + light | Fixed body / folded Jump robe | Binary alpha | Pixel clusters without smoothing',font=font,fill='#adb9c8')
    y=60
    for p in panels:out.paste(p,(0,y));y+=p.height+12
    out.save(ROOT/'tools/anim_preview3.png',compress_level=9)


def validate():
    for path,entry in MANIFEST.items():
        im=Image.open(ASSETS/path)
        w,h=entry['frameWidth'],entry['frameHeight']
        assert im.mode=='RGBA' and im.size==(w*entry['frames'],h)
        a=np.array(im)
        assert set(np.unique(a[:,:,3]))=={0,255}
        assert not np.any(a[a[:,:,3]==0,:3])
        palette=set()
        for src in entry['source']['files']:
            with Image.open(ASSETS/src) as source:
                palette.update(p for p in source.convert('RGBA').get_flattened_data() if p[3]==255)
        assert not set(map(tuple,a[a[:,:,3]==255]))-palette,(path,'non-native inks')
        for i in range(entry['frames']):
            f=im.crop((i*w,0,(i+1)*w,h))
            box=f.getbbox()
            assert box,(path,i,'empty frame')
            if 'platform_crack' in path:
                assert f.crop((0,0,1,h)).tobytes()==f.crop((w-1,0,w,h)).tobytes()
            else:
                assert box[0]>0 and box[1]>0 and box[2]<w and box[3]<=h,(path,i,box)
        entry['technical_checks_passed']=True
        print(f'PASS {path}: {im.width}x{im.height}, {entry["frames"]} frames, source inks, binary alpha')
    counts=[np.count_nonzero(np.array(f)[:,:,3]) for f in PREVIEWS[-1][1]]
    assert counts==sorted(counts),('crack progression',counts)
    for src,digest in HASHES.items():
        assert hashlib.sha256((ASSETS/src).read_bytes()).hexdigest()==digest,src
    (ASSETS/'anim_sprites3.json').write_text(json.dumps(MANIFEST,indent=2,ensure_ascii=False)+'\n')


def main():
    # Guard all existing sprites/JSON, including sources not used in this batch.
    protected={p:hashlib.sha256(p.read_bytes()).hexdigest() for p in ASSETS.rglob('*')
               if p.is_file() and p.relative_to(ASSETS).as_posix() not in OUTPUTS+['anim_sprites3.json']}
    jump=jump_attack()
    warm=['slime/Slime3_Idle_with_shadow.png','slime/Slime3_Walk_with_shadow.png']
    save(OUTPUTS[0],jump,['aidan/Jump.png','aidan/Fall.png','aidan/Attack2.png','fx/ghostfire.png'],
         JUMP,(85,75,220,174),167,
         'Native Jump folded legs/body locked at original scale; shoulder/staff joints. Windup 0-1, horizontal ghostfire sweep x150-215 y99-149 in 2-3, recovery 4-5.',
         ['PREP','LOAD','HIT','SWEEP','FOLLOW','RECOVER'])
    orb=orb_frames()
    save(OUTPUTS[1],orb,warm,SLIMES[0].crop((19,12,43,43)),(0,0,20,20),None,
         'Amber HUD-orb interpretation using native slime fire inks; faceted sphere, fixed centre, 1px charcoal contour, orbiting specular star.', ['']*6)
    save(OUTPUTS[2],pickup_frames(),warm,SLIMES[2].crop((21,8,42,40)),(0,0,32,32),None,
         'Expanding broken amber ring, cream flash and dispersing sparks; binary-alpha dissolution.', ['FLASH','EXPAND','BREAK','SHED','EMBERS'])
    save(OUTPUTS[3],lava_frames(),warm,WALK[0].crop((17,12,45,43)),(0,0,64,24),23,
         'Native source rock facets and unscaled slime flame islands. Charcoal rim and golden molten channels on bottom rows 16-23.', ['']*6)
    save(OUTPUTS[4],crack_frames(),warm,SLIMES[0].crop((22,25,42,41)),(0,0,64,16),None,
         'Four cumulative charcoal fissure overlays with native rock dust; matching edge pixels for seamless 64px horizontal tiling over 32px platform.', ['HAIRLINE','SPLIT','FRACTURE','CRITICAL'])
    validate()
    preview()
    assert all(hashlib.sha256(p.read_bytes()).hexdigest()==digest for p,digest in protected.items())
    print('PASS protected existing sprites/JSON unchanged; fixed Jump body; crack growth and wrap')


if __name__=='__main__':
    main()
