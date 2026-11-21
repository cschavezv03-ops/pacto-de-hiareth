#!/usr/bin/env python3
"""Pixel-derived dodge, low sweep and charge; run with tools/.venv/bin/python.

Writes ONLY Crouch.png, sweep.png, charge.png, anim_sprites2.json and
anim_preview2.png. Source poses/inks are inherited project artwork. Reuses the
first generator's slicing, pixel islands, compositing, palette and hash utilities;
never invokes its main, writer or validator. No AI artwork or smoothing.

Use --crouch-only to update ONLY Crouch.png and anim_preview2.png, reading the
existing skeleton strips for the preview and leaving their manifest untouched.
"""
from __future__ import annotations
import argparse
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import gen_anim_sprites as old

ROOT, ASSETS, NEAREST = old.ROOT, old.ASSETS, old.NEAREST
frame, canvas, cut = old.frame, old.canvas, old.cut
composite_at, nearest_colour = old.composite_at, old.nearest_colour
MANIFEST, PREVIEWS = {}, []


def region(im, box=None, polygon=None):
    """Cut articulated source clusters without changing texture or scale."""
    a = np.array(im)
    m = Image.new('L', im.size)
    d = ImageDraw.Draw(m)
    if polygon:
        d.polygon(polygon, fill=255)
    else:
        d.rectangle((box[0], box[1], box[2]-1, box[3]-1), fill=255)
    a[np.asarray(m) == 0] = 0
    return Image.fromarray(a)


def joint(dest, part, pivot, target, angle=0):
    """Rigid nearest rotation about a named joint; all inks stay verbatim."""
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    px, py = pivot; tx, ty = target
    # Pillow uses screen coordinates; positive angle turns counterclockwise.
    transformed = part.transform(dest.size, Image.Transform.AFFINE,
        (c, -s, px-c*tx+s*ty, s, c, py-s*tx-c*ty), resample=NEAREST)
    dest.alpha_composite(transformed)


def aidan_crouch():
    idle = frame('aidan/Idle.png')
    attack = frame('aidan/Attack1.png')
    folded = region(attack, polygon=[(109,128),(123,128),(125,137),
        (131,137),(136,139),(138,143),(136,150),(144,156),
        (144,167),(101,167),(101,152),(103,147),(101,141),(106,138)])
    # The same folded shoulders rise four pixels for the first knee bend.
    # A native embroidered waist patch bridges the fold without a transparent
    # seam, duplicated staff, stretched anatomy or an invented flat fill.
    f0 = region(folded, (100,155,145,167))
    joint(f0,region(folded,(100,156,145,163)),(0,0),(0,-6))
    joint(f0,region(folded,(100,128,145,155)),(0,0),(0,-4))
    f1 = folded
    # One-pixel breathing through head, collar and arms, feet/robe hem locked.
    f2 = region(folded, (100,150,145,167))
    joint(f2, region(folded, (100,128,145,151)), (0,0), (0,1))
    # Isolate Idle's complete flame and wood, without its standing body/hand.
    staff = region(idle, polygon=[(124,72),(166,72),(166,119),(148,119),
        (148,138),(144,167),(138,167),(140,138),(140,129),(143,122),
        (139,119),(133,119),(133,110),(124,110)])
    a = np.array(staff)
    # Idle's grip hides seven scanlines: bridge them with adjacent native wood.
    a[129:136,140:148] = np.asarray(idle)[137:144,140:148]
    staff = Image.fromarray(a)
    wood_inks = {(40,9,22,255),(59,14,32,255),(59,15,33,255),
        (101,37,62,255),(47,28,36,255),(32,18,28,255)}
    skin_inks = {(135,83,104,255),(161,104,145,255),
        (74,43,56,255),(62,37,48,255)}
    source = np.asarray(attack)
    result = []
    for body, dy in zip([f0,f1,f2], [-4,0,1]):
        box = body.getbbox()
        assert box[1] >= 121 and box[3] == 167, ('crouched body', box)
        assert box[2]-box[0] <= 46, ('crouched body width', box)
        original = np.asarray(body)
        a = np.array(body)
        hands = np.zeros_like(a)
        # Remove Attack's opposite-sloping shaft; expose its own robe pixels
        # beneath it. Keep the two native hands in front of the replacement.
        for y in range(138+dy,156+dy):
            for x in range(101,137):
                pixel = tuple(original[y,x])
                if pixel in wood_inks:
                    a[y,x] = source[min(y-dy+7,166),x] if x <= 123 else 0
                if pixel in skin_inks:
                    hands[y,x] = original[y,x]
        body = Image.fromarray(a)
        # Diagonal through the front grip: butt behind, ghost flame ahead of
        # the hood. One rigid NEAREST rotation preserves the original inks.
        joint(body, staff, (144,133), (120,148+dy), -55)
        body.alpha_composite(Image.fromarray(hands))
        result.append(body)
    return result, idle


ATTACK = frame('skeleton/attack.png', 0, 256)
WINDUP = frame('skeleton/windup.png', 0, 256)
ATK1 = frame('skeleton/attack.png', 1, 256)
WALK = frame('skeleton/walk.png', 0, 256)
BONE = nearest_colour(ATTACK, (240,234,206))
GOLD = nearest_colour(ATK1, (168,137,63))
WHITE = nearest_colour(frame('skeleton/attack.png',4,256), (232,241,232))
DUST = nearest_colour(WALK, (135,144,123))
DUST_DARK = nearest_colour(WALK, (97,111,99))
OUTLINE = nearest_colour(ATTACK, (40,33,43))
# The raised source branch is isolated above the fist/skull, then rigidly
# levelled. Native fork, dark edging and grain remain intact.
BRANCH_SOURCE = region(ATK1, polygon=[(51,18),(80,18),(87,29),(93,12),
    (104,12),(108,30),(122,38),(145,43),(159,51),(171,50),
    (180,59),(192,63),(194,77),(180,79),(161,70),(145,64),
    (128,56),(110,52),(92,43),(77,43),(62,36),(51,34)])
BRANCH_SOURCE = old.components(BRANCH_SOURCE)[0]
BRANCH = cut(cut(BRANCH_SOURCE).rotate(23, NEAREST, expand=True))


def shadow():
    a=np.array(ATTACK)
    yy,xx=np.mgrid[:256,:256]
    # Separate the full native green ground ellipse from cream feet; retaining
    # only its last scanlines would leave a visibly clipped, flat upper edge.
    r,g,b=[a[:,:,k].astype(int) for k in range(3)]
    keep=(yy>=213)&(yy<249)&(g>r+3)&(g>b+3)&(r<145)
    a[~keep]=0
    return Image.fromarray(a)


def torso(source):
    return region(source, polygon=[(72,40),(184,40),(184,141),
        (156,145),(149,154),(149,174),(143,183),(111,183),
        (110,154),(108,143),(72,141)])


def bent_legs(f, depth, amount=1):
    """Rotate source thighs and shins independently; never squash anatomy."""
    for box,pivot,target,ang in [
        ((109,188,129,208),(120,191),(116,201+depth),60),
        ((105,205,126,232),(118,207),(130,209+depth),-25),
        ((139,188,161,208),(147,191),(139,201+depth),54),
        ((142,205,166,232),(151,207),(152,210+depth),-30)]:
        target=tuple(round(p+(t-p)*amount) for p,t in zip(pivot,target))
        joint(f,region(WINDUP,box),pivot,target,ang*amount)


def warning(f, phase, cx, cy):
    """Hard-edged cream/gold telegraph, deliberately distinct from red windup."""
    d=ImageDraw.Draw(f)
    for dx,dy in [(-8,0),(0,-8),(8,0),(0,8)]:
        d.line((cx+dx,cy+dy,cx+round(dx*.55),cy+round(dy*.55)),fill=GOLD,width=2)
    d.line((cx-4,cy,cx+4,cy),fill=WHITE,width=2)
    d.line((cx,cy-4,cx,cy+4),fill=WHITE,width=2)
    if phase:
        for x,y in [(cx-16,cy+6),(cx+13,cy-5),(cx-5,cy-16)]:
            old.stamp_spark(f,x,y,BONE,2)


def low_arc(f, phase):
    """Stepped shallow perspective arc: EVERY effect pixel is y=225..248."""
    d=ImageDraw.Draw(f)
    points=([(76,228),(92,234),(113,239),(143,243),(177,244),
             (210,241),(231,235),(241,227)] if phase==0 else
            [(84,232),(109,239),(140,244),(178,246),(213,243),
             (236,237),(246,228)])
    d.line(points,fill=GOLD,width=4)
    d.line([(x,y-1) for x,y in points[1:]],fill=WHITE,width=2)
    # Detached trailing strokes, never a filled disk or high vertical slash.
    d.line([(96,229),(113,233),(131,235)],fill=BONE,width=2)
    if phase:
        d.line([(205,231),(225,228),(236,225)],fill=WHITE,width=2)


def skeleton_sweep():
    result=[]
    for i,(depth,tilt) in enumerate([(0,-9),(4,-15),(4,-20),(3,-17),(1,-8),(0,-3)]):
        f=shadow()
        bent_legs(f,depth,[1,1,1,1,.5,0][i])
        hip_y=[200,204,204,203,192,187][i]
        torso_y=[197,201,201,200,190,181][i]
        joint(f,region(WINDUP,(108,180,155,198)),(130,187),(129,hip_y))
        joint(f,torso(ATTACK),(130,181),(128,torso_y),tilt)
        # A rear elbow follows the crouch rather than leaving a second idle arm.
        joint(f,region(ATTACK,(90,146,111,196)),(102,147),(110,torso_y-31),24)
        # The branch rotates through the ground plane, not over the skull.
        if i in (0,1):
            branch=BRANCH.rotate(-9 if i==0 else -3,NEAREST,expand=True)
            a=np.array(branch)
            yy,xx=np.mgrid[:a.shape[0],:a.shape[1]]
            wood=(a[:,:,3]==255)&(a[:,:,0].astype(int)>a[:,:,1].astype(int)+5)&(a[:,:,1].astype(int)>a[:,:,2].astype(int)+9)&(a[:,:,0]>100)
            a[wood&((xx//3+yy//3)%5==0)]=GOLD
            a[wood&((xx//3+yy//3)%7==i)]=WHITE
            branch=Image.fromarray(a)
            composite_at(f,branch,(28 if i==0 else 15,209-branch.height//2))
            warning(f,i,39 if i==0 else 24,201)
        elif i in (2,3):
            branch=BRANCH.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            composite_at(f,branch,(103 if i==2 else 108,226-branch.height//2))
        else:
            branch=BRANCH.transpose(Image.Transpose.FLIP_LEFT_RIGHT).rotate(12 if i==4 else 28,NEAREST,expand=True)
            composite_at(f,branch,(99,[210,192][i-4]-branch.height//2))
        # Front upper arm + forearm from the source, hinged toward the low grip.
        joint(f,region(ATTACK,(149,148,171,198)),(154,153),
            (153,torso_y-23),-12 if i<2 else 12)
        if i in (2,3):low_arc(f,i-2)
        result.append(f)
    return result


def dust(f,i):
    d=ImageDraw.Draw(f)
    # Reuse the original bone-shin texture as a couple of shed chips.
    chip=region(WALK,(107,205,116,212)).crop((107,205,116,212))
    for k in range(2):
        bit=cut(chip.rotate(25+i*25+k*40,NEAREST,expand=True))
        composite_at(f,bit,(48+k*25-(i*3)%9,217-k*8))
    for k,(x,y) in enumerate([(40,236),(58,228),(77,238),(27,231)]):
        xx=x-(i*4+k*3)%11; yy=y-(i+k)%3
        d.line([(xx,yy),(xx+4,yy-3),(xx+9,yy-3),(xx+13,yy)],fill=DUST_DARK,width=3)
        d.line([(xx+3,yy-3),(xx+7,yy-5),(xx+10,yy-4)],fill=DUST,width=2)


def skeleton_charge():
    result=[]
    for i,n in enumerate([0,2,4,6]):
        source=frame('skeleton/walk.png',n,256)
        f=shadow()
        dust(f,i)
        # Original walk legs retain four distinct strides and exact native scale.
        legs=region(source,(91,180,174,229))
        joint(f,legs,(130,187),(126,193))
        joint(f,torso(source),(130,181),(131,184+(-1 if i%2 else 0)),-16)
        # Trailing arm then forward arm, pivoted at the source shoulder joints.
        joint(f,region(source,(89,143,111,196)),(101,146),(114,153),-32)
        branch=BRANCH.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        composite_at(f,branch,(109,168-branch.height//2+(-1 if i%2 else 0)))
        joint(f,region(source,(148,144,171,196)),(151,148),(160,158),65)
        result.append(f)
    return result


def save_strip(path,frames,sources,reference,crop,baseline,notes,write=True):
    if not write:
        PREVIEWS.append((path,frames,reference,crop,baseline,notes))
        return
    w,h=frames[0].size
    strip=canvas(w*len(frames),h)
    for i,f in enumerate(frames):composite_at(strip,f,(i*w,0))
    a=np.array(strip);a[a[:,:,3]==0]=0
    Image.fromarray(a).save(ASSETS/path,compress_level=9)
    MANIFEST[path]={'frameWidth':w,'frameHeight':h,'frames':len(frames),
        'source':{'kind':'deterministic-pixel-derivative','files':sources},
        'license':'Inherited from project source artwork; no external artwork added.',
        'baseline':baseline,'notes':notes,'technical_checks_passed':False}
    PREVIEWS.append((path,frames,reference,crop,baseline,notes))


def preview():
    font=ImageFont.load_default(size=16)
    title=ImageFont.load_default(size=20)
    panels=[]
    for path,frames,ref,crop,base,notes in PREVIEWS:
        cw,ch=(crop[2]-crop[0])*2,(crop[3]-crop[1])*2
        references = [ref,frame('aidan/Attack1.png')] if 'Crouch' in path else [ref]
        p=Image.new('RGB',((cw+12)*(len(frames)+len(references))+12,94+2*(ch+36)),'#252833');d=ImageDraw.Draw(p)
        d.text((12,8),path+' / x2 NEAREST / ORIGINAL + ALL FRAMES',font=title,fill='#f4e5ce')
        d.text((12,36),f'Fixed crop {crop} | baseline {base}',font=font,fill='#bbc1ce')
        d.text((12,60),'Cyan = y121 BODY ceiling; staff/flame may rise above' if 'Crouch' in path else 'Feet / low sweep zone y225-248',font=font,fill='#71d4cb')
        for row,bg in enumerate(['#171b28','#e8e0cc']):
            yy=90+row*(ch+36)
            for j,f in enumerate(references+frames):
                xx=12+j*(cw+12);d.rectangle((xx,yy,xx+cw-1,yy+ch-1),fill=bg)
                if 'Crouch' in path:
                    gy=yy+(121-crop[1])*2
                    for gx in range(xx,xx+cw,10):d.line((gx,gy,gx+4,gy),fill='#409f9d')
                view=f.crop(crop).resize((cw,ch),NEAREST);p.paste(view,(xx,yy),view)
                gy=yy+(base-crop[1])*2
                for gx in range(xx,xx+cw,12):d.line((gx,gy,gx+4,gy),fill='#947c68')
                labels=['FLEX','LOW','BREATH'] if 'Crouch' in path else (['PREP','HOLD','SWEEP','SWEEP','RECOVER','RECOVER'] if 'sweep' in path else ['STRIDE A','STRIDE B','STRIDE C','STRIDE D'])
                n=j-len(references)
                label=('IDLE' if j==0 else 'ATTACK') if 'Crouch' in path and n<0 else ('ORIGINAL' if n<0 else f'{n} {labels[n]}')
                d.text((xx+3,yy+ch+6),label,font=font,fill='#d2d8df')
        panels.append(p)
    out=Image.new('RGB',(max(p.width for p in panels),sum(p.height+14 for p in panels)+64),'#10141c')
    d=ImageDraw.Draw(out);d.text((14,12),'EL PACTO DE HIARETH / PIXEL DERIVATIVES / ART REVIEW 2',font=title,fill='#f4e5ce')
    y=64
    for p in panels:out.paste(p,(0,y));y+=p.height+14
    out.save(ROOT/'tools/anim_preview2.png',compress_level=9)


def validate(write_manifest=True):
    for phase in range(2):
        effect=canvas(256);low_arc(effect,phase)
        box=effect.getbbox()
        assert box[1]>=225 and box[3]<=249,('low arc height',phase,box)
    for path,entry in MANIFEST.items():
        im=Image.open(ASSETS/path).convert('RGBA');a=np.array(im)
        w,h=entry['frameWidth'],entry['frameHeight']
        assert im.size==(w*entry['frames'],h)
        assert set(np.unique(a[:,:,3]))=={0,255},path
        palette=set()
        for src in entry['source']['files']:
            b=np.array(Image.open(ASSETS/src).convert('RGBA'))
            palette.update(map(tuple,b[b[:,:,3]==255]))
        inks=set(map(tuple,a[a[:,:,3]==255]))
        assert not inks-palette,(path,'non-source inks')
        for n in range(entry['frames']):
            f=im.crop((n*w,0,(n+1)*w,h));box=f.getbbox()
            assert box and 0<box[0] and 0<box[1] and box[2]<w and box[3]<h,(path,n,box)
            if 'Crouch' in path:
                # Body limits are checked before the staff is composited.
                assert box[1]>=105 and box[3]==167,(n,box)
                assert box[2]-box[0]<=90,(n,box)
                pixels=np.asarray(f)
                assert np.count_nonzero(np.all(pixels==old.VIOLET,axis=2))>150,(n,'missing violet flame')
                assert np.count_nonzero(np.all(pixels==old.RED,axis=2))>=5,(n,'missing ghost eye')
        entry['technical_checks_passed']=True
        print(f'PASS {path}: {im.width}x{im.height}, {entry["frames"]} frames, native inks, binary alpha')
    for source,sha in old.SOURCE_HASHES.items():
        assert hashlib.sha256((ASSETS/source).read_bytes()).hexdigest()==sha,source
    if write_manifest:
        (ASSETS/'anim_sprites2.json').write_text(json.dumps(MANIFEST,indent=2,ensure_ascii=False)+'\n')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--crouch-only',action='store_true')
    args=parser.parse_args()
    crouch,ref=aidan_crouch()
    save_strip('aidan/Crouch.png',crouch,['aidan/Idle.png','aidan/Attack1.png'],ref,
        (68,70,178,175),167,'Original Idle ghost-flame staff tilted forwards; crouched BODY top >=121; fixed hem; one-pixel breath.')
    sweep=([frame('skeleton/sweep.png',n,256) for n in range(6)] if args.crouch_only else skeleton_sweep())
    save_strip('skeleton/sweep.png',sweep,['skeleton/attack.png','skeleton/windup.png'],ATK1,
        (0,0,256,256),248,'Low crouch, cream/gold warning 0-1, ground-level branch and arc 2-3, recovery 4-5. Articulated source bones, native branch grain.',write=not args.crouch_only)
    charge=([frame('skeleton/charge.png',n,256) for n in range(4)] if args.crouch_only else skeleton_charge())
    save_strip('skeleton/charge.png',charge,['skeleton/walk.png','skeleton/attack.png'],WALK,
        (0,0,256,256),248,'Four original walking strides; rigid forward torso lean, branch held ahead, rear source-bone chips and dust.',write=not args.crouch_only)
    validate(write_manifest=not args.crouch_only);preview()


if __name__=='__main__':main()
