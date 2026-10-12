from pathlib import Path
import json
import math
from collections import defaultdict
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(__file__).with_name('reference.png')
COLORS = {'terracotta': '#C76B50', 'shade': '#A9513B', 'light': '#D78061', 'cream': '#FFF7EC', 'ink': '#3E281F'}
RGB = np.asarray(Image.open(SOURCE).convert('RGB')).astype(np.int16)
H, W = RGB.shape[:2]

def area(points):
    return sum(x * yy - xx * y for (x, y), (xx, yy) in zip(points, points[1:] + points[:1])) / 2

def outlines(mask, min_area=25):
    padded = np.pad(mask, 1)
    top = mask & ~padded[:-2, 1:-1]
    right = mask & ~padded[1:-1, 2:]
    bottom = mask & ~padded[2:, 1:-1]
    left = mask & ~padded[1:-1, :-2]
    graph = defaultdict(list)
    for edges, direction in [(top, 0), (right, 1), (bottom, 2), (left, 3)]:
        ys, xs = np.nonzero(edges)
        for x, y in zip(xs.tolist(), ys.tolist()):
            a, b = [( (x,y),(x+1,y) ), ((x+1,y),(x+1,y+1)), ((x+1,y+1),(x,y+1)), ((x,y+1),(x,y))][direction]
            graph[a].append(b)
    loops = []
    while graph:
        start = next(iter(graph))
        current, points = start, []
        previous_direction = None
        while True:
            points.append(current)
            options = graph[current]
            if len(options) > 1 and previous_direction is not None:
                def preference(end):
                    dx, dy = end[0]-current[0], end[1]-current[1]
                    direction = {(1,0):0,(0,1):1,(-1,0):2,(0,-1):3}[(dx,dy)]
                    turn = (direction-previous_direction) % 4
                    return {1:0,0:1,3:2,2:3}[turn]
                nxt = min(options, key=preference)
                options.remove(nxt)
            else:
                nxt = options.pop()
            if not options:
                del graph[current]
            previous_direction = {(1,0):0,(0,1):1,(-1,0):2,(0,-1):3}[(nxt[0]-current[0],nxt[1]-current[1])]
            current = nxt
            if current == start:
                break
        if abs(area(points)) >= min_area:
            loops.append(points)
    return sorted(loops, key=lambda p: abs(area(p)), reverse=True)

def rdp(points, tolerance):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], dtype=float), np.array(points[-1], dtype=float)
    p = np.array(points, dtype=float)
    delta = b-a
    norm = np.linalg.norm(delta)
    dist = np.linalg.norm(p-a, axis=1) if norm == 0 else abs(delta[0]*(p[:,1]-a[1])-delta[1]*(p[:,0]-a[0])) / norm
    i = int(np.argmax(dist))
    if dist[i] > tolerance:
        return rdp(points[:i+1],tolerance)[:-1] + rdp(points[i:],tolerance)
    return [points[0],points[-1]]

def simplify_closed(points, tolerance):
    first = min(range(len(points)), key=lambda i: (points[i][1],points[i][0]))
    ring = points[first:] + points[:first]
    far = max(range(len(ring)), key=lambda i: (ring[i][0]-ring[0][0])**2+(ring[i][1]-ring[0][1])**2)
    return rdp(ring[:far+1], tolerance)[:-1] + rdp(ring[far:]+[ring[0]], tolerance)[:-1]

def fmt(v):
    return f'{v:.4f}'.rstrip('0').rstrip('.')

def smooth_path(points, tolerance=1.0):
    p = simplify_closed(points,tolerance)
    result = [f'M{fmt(p[0][0])} {fmt(p[0][1])}']
    for i in range(len(p)):
        prev, a, b, after = [p[j%len(p)] for j in (i-1,i,i+1,i+2)]
        # Low-tension interpolating curves preserve the traced contour and rounded corners.
        c1 = (a[0]+(b[0]-prev[0])*0.10, a[1]+(b[1]-prev[1])*0.10)
        c2 = (b[0]-(after[0]-a[0])*0.10, b[1]-(after[1]-a[1])*0.10)
        result.append('C'+' '.join(fmt(v) for v in (*c1,*c2,*b)))
    return ' '.join(result)+'Z'

def unit(v):
    length=np.linalg.norm(v)
    return v/length if length else v

def fit_curves(points,left,right,error=1.25):
    points=np.asarray(points,dtype=float)
    if len(points)==2:
        distance=np.linalg.norm(points[1]-points[0])/3
        return [np.array([points[0],points[0]+left*distance,points[-1]+right*distance,points[-1]])]
    u=np.r_[0,np.cumsum(np.linalg.norm(np.diff(points,axis=0),axis=1))]
    u=u/u[-1]
    s=1-u
    B=np.column_stack([s**3,3*u*s*s,3*u*u*s,u**3])
    A=np.stack([B[:,1,None]*left,B[:,2,None]*right],axis=1)
    residual=points-(B[:,0]+B[:,1])[:,None]*points[0]-(B[:,2]+B[:,3])[:,None]*points[-1]
    C=np.einsum('nik,njk->ij',A,A)
    X=np.einsum('nik,nk->i',A,residual)
    try:
        alpha=np.linalg.solve(C,X)
    except np.linalg.LinAlgError:
        alpha=np.zeros(2)
    chord=np.linalg.norm(points[-1]-points[0])
    if min(alpha)<chord*1e-5:
        alpha=np.array([chord/3,chord/3])
    controls=np.array([points[0],points[0]+left*alpha[0],points[-1]+right*alpha[1],points[-1]])
    distance=np.sum((B@controls-points)**2,axis=1)
    split=int(np.argmax(distance))
    if distance[split]<=error**2:
        return [controls]
    split=max(1,min(split,len(points)-2))
    centre=unit(points[split-1]-points[split+1])
    return fit_curves(points[:split+1],left,centre,error)+fit_curves(points[split:],-centre,right,error)

def fitted_outline(points):
    # Fit true cubic curves to gently filtered glyph contours instead of retaining pixel steps.
    p=np.asarray(points,dtype=float)[::2]
    if len(p)<4:
        return smooth_path(points,0.8)
    far=int(np.argmax(np.sum((p-p[0])**2,axis=1)))
    sections=[p[:far+1],np.vstack([p[far:],p[0]])]
    curves=[]
    for section in sections:
        curves+=fit_curves(section,unit(section[1]-section[0]),unit(section[-2]-section[-1]))
    return f'M{fmt(p[0,0])} {fmt(p[0,1])} '+' '.join('C'+' '.join(fmt(v) for v in c[1:].reshape(-1)) for c in curves)+'Z'

r,g,b = RGB[:,:,0],RGB[:,:,1],RGB[:,:,2]
logo_box = np.zeros((H,W),dtype=bool)
logo_box[145:865,280:990] = True
main_mask = logo_box & (r>120) & (g<185) & (b<155) & (r-g>32) & (g-b>9)
cream_mask = logo_box & (r>230) & (g>215) & (b>190) & (r-g>2) & (g-b>4)
face_loops = outlines(cream_mask, min_area=150)
face = face_loops[0]
page_loops = [p for p in face_loops[1:] if min(x for x,y in p)>750]
face_path = smooth_path(face, 1.8)
page_path = ' '.join(smooth_path(p,1.2) for p in page_loops)
main_path = ' '.join(smooth_path(p,1.7) for p in outlines(main_mask,min_area=50))

features_mask = np.zeros((H,W),dtype=bool)
features_mask[490:650,465:750] = (r[490:650,465:750]<115) & (g[490:650,465:750]<95) & (b[490:650,465:750]<80)
feature_path = ' '.join(smooth_path(p,0.7) for p in outlines(features_mask,min_area=50))

word_mask = np.zeros((H,W),dtype=bool)
word_mask[865:1090,320:935] = (r[865:1090,320:935]<125) & (g[865:1090,320:935]<100) & (b[865:1090,320:935]<85)
word_mask=np.asarray(Image.fromarray(word_mask.astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(1.2)))>127
word_loops = outlines(word_mask,min_area=50)
word_path = ' '.join(fitted_outline(p) for p in word_loops)
wy,wx = np.nonzero(word_mask)
word_bounds = [int(wx.min()),int(wy.min()),int(wx.max()+1),int(wy.max()+1)]
ww,wh = word_bounds[2]-word_bounds[0],word_bounds[3]-word_bounds[1]

# The small-size mark keeps the face and removes only the thin page-turn detail.
small_mask = main_mask.copy()
for p in page_loops:
    from PIL import ImageDraw
    temp = Image.new('1',(W,H))
    ImageDraw.Draw(temp).polygon(p,fill=1)
    small_mask |= np.asarray(temp,dtype=bool)
small_path = ' '.join(smooth_path(p,2.2) for p in outlines(small_mask,min_area=50))

art_bounds=[294,160,977,860]
aw,ah=art_bounds[2]-art_bounds[0],art_bounds[3]-art_bounds[1]
shade_path='M280 140H418C510 153 606 294 686 418L602 858H280Z'

# Reconstruct the selected mark with deliberate, compact cubic curves.
# The traced glyphs above preserve the source's custom-looking wordmark.
outer_path='M418 160C480 155 536 185 600 224C692 290 767 312 857 302L919 297C950 292 976 315 976 347V702C976 738 956 759 921 764L758 790C682 803 641 819 618 858H602C581 819 559 800 523 790C474 778 416 774 352 764C316 759 294 738 294 702V309C294 239 340 178 388 165C398 162 408 160 418 160Z'
face_path='M558 361C611 352 656 396 705 434L773 482C808 510 805 551 783 580C744 633 672 664 637 714C617 744 618 779 618 858H602C604 796 593 751 560 716C529 688 477 661 446 625C420 595 413 565 416 531C417 451 463 391 513 370C529 364 544 361 558 361Z'
page_path='M716 794C789 772 851 753 907 734C943 721 967 699 976 662V702C976 738 956 759 921 764C854 775 784 785 716 794Z'

# A clean, outlined reconstruction of the selected rounded lowercase wordmark.
# Each glyph uses a small number of intentional curves, rather than pixel contours.
t_glyph='M30 11H48Q56 11 56 19V52H85Q94 52 94 60V75Q94 83 86 83H56V140Q56 158 70 158Q78 158 86 154L94 175Q77 187 57 186Q20 185 20 148V83H8Q0 83 0 75V60Q0 52 8 52H20V21Q20 11 30 11Z'
a_glyph='M116 65C135 49 163 43 186 51C218 58 234 81 234 113V178Q234 186 226 186H211Q203 186 203 178V169C190 181 177 187 159 186C130 185 110 168 110 145C110 120 129 107 160 105L199 103V99C199 85 189 78 171 78C157 78 144 83 134 91ZM199 125L167 126C152 127 144 133 144 145C144 158 156 164 171 161C188 160 199 149 199 133Z'
l_glyph='M254 0H274Q280 0 280 6V180Q280 186 274 186H254Q248 186 248 180V6Q248 0 254 0Z'
e_glyph='M425 125H331C335 145 348 156 366 156C382 156 397 150 407 139L424 160C410 177 391 186 365 186C324 186 297 159 297 120C297 79 323 50 348 50C384 44 411 62 421 91C426 105 428 116 425 125ZM331 103H393C391 86 380 77 364 77C347 77 335 87 331 103Z'

def face_features(color,small=False):
    transform=' transform="translate(604 572) scale(1.08) translate(-604 -572)"' if small else ''
    return f'<g fill="{color}" stroke="{color}" stroke-width="17" stroke-linecap="round"{transform}><circle cx="520" cy="537" r="26" stroke="none"/><path d="M657 544Q691 507 724 544" fill="none"/><path d="M568 599C583 615 609 615 624 599" fill="none"/></g>'

def icon_art(style='primary',small=False):
    monochrome=style in ('dark','white')
    color=COLORS['ink'] if style=='dark' else '#FFFFFF' if style=='white' else COLORS['terracotta']
    main=outer_path
    fill=color if style!='primary' else 'url(#terracotta)'
    defs=''
    if style=='primary':
        defs=f'<linearGradient id="terracotta" x1="294" y1="320" x2="977" y2="660" gradientUnits="userSpaceOnUse"><stop stop-color="{COLORS["terracotta"]}"/><stop offset="1" stop-color="{COLORS["light"]}"/></linearGradient>'
    defs+=f'<clipPath id="book-clip"><path d="{main}"/></clipPath>'
    cutouts=f'<path d="{face_path}" fill="#000000"/>'
    if not small:
        cutouts+=f'<path d="{page_path}" fill="#000000"/>'
    defs+=f'<mask id="cutouts" maskUnits="userSpaceOnUse" x="280" y="140" width="720" height="740"><rect x="280" y="140" width="720" height="740" fill="#FFFFFF"/>{cutouts}</mask>'
    result=f'<g mask="url(#cutouts)"><path d="{main}" fill="{fill}"/>'
    if not monochrome and style!='flat-small' and not small:
        result+=f'<path d="{shade_path}" fill="{COLORS["shade"]}" clip-path="url(#book-clip)"/>'
    result+='</g>'
    if not monochrome:
        result+=f'<path d="{face_path}" fill="{COLORS["cream"]}" clip-path="url(#book-clip)"/>'
        if page_path and not small:
            result+=f'<path d="{page_path}" fill="{COLORS["cream"]}" fill-rule="evenodd"/>'
    feature_fill=color if monochrome else COLORS['ink']
    result+=face_features(feature_fill,small)
    return defs,f'<g transform="translate(-294 -160)">{result}</g>'

def word_art(style):
    color='#FFFFFF' if style=='white' else COLORS['terracotta'] if style=='terracotta' else COLORS['ink']
    return f'<g fill="{color}" fill-rule="evenodd"><path d="{t_glyph}"/><path d="{a_glyph}"/><path d="{l_glyph}"/><path d="{e_glyph}"/><path d="{a_glyph}" transform="translate(322)"/></g>'

def svg(layout,style='primary',small=False):
    defs,icon=icon_art(style,small)
    title='Talea – '+{'icon':'Bildmarke','stacked':'Logo untereinander','horizontal':'Logo horizontal','wordmark':'Wortmarke','app':'App-Icon'}[layout]
    if layout=='icon':
        vw,vh=800,800
        body=f'<g transform="translate({fmt((vw-aw)/2)} {fmt((vh-ah)/2)})">{icon}</g>'
    elif layout=='stacked':
        vw,vh=800,1000
        body=f'<g transform="translate({fmt((vw-aw)/2)} 40)">{icon}</g><g transform="translate({fmt((vw-ww)/2)} 766)">{word_art(style)}</g>'
    elif layout=='horizontal':
        icon_scale=160/ah
        word_scale=108/wh
        iw,tw=aw*icon_scale,ww*word_scale
        vw,vh=round(iw+44+tw+64),224
        body=f'<g transform="translate(32 32) scale({fmt(icon_scale)})">{icon}</g><g transform="translate({fmt(32+iw+44)} 58) scale({fmt(word_scale)})">{word_art(style)}</g>'
    elif layout=='wordmark':
        vw,vh=ww+64,wh+64
        body=f'<g transform="translate(32 32)">{word_art(style)}</g>'
        defs=''
    else:
        vw,vh=1024,1024
        scale=760/max(aw,ah)
        body=f'<rect width="1024" height="1024" fill="{COLORS["cream"]}"/><g transform="translate({fmt((1024-aw*scale)/2)} {fmt((1024-ah*scale)/2)}) scale({fmt(scale)})">{icon}</g>'
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" role="img" aria-labelledby="title"><title id="title">{title}</title><desc>Terrakottafarbenes Buch mit integriertem zwinkerndem Avatar. Eigenständige Vektorpfade ohne eingebettete Bilder oder Schriftdateien.</desc><defs>{defs}</defs>{body}</svg>\n'

files=[]
for style in ('primary','flat','dark','white'):
    for layout in ('icon','stacked','horizontal'):
        name=f'talea-{layout}-{style}.svg'
        (ROOT/'svg').mkdir(exist_ok=True)
        (ROOT/'svg'/name).write_text(svg(layout,style),encoding='utf-8')
        files.append(name)
for style in ('primary','dark','white'):
    name=f'talea-icon-small-{style}.svg'
    (ROOT/'svg'/name).write_text(svg('icon',style,small=True),encoding='utf-8')
    files.append(name)
for style in ('dark','terracotta','white'):
    name=f'talea-wordmark-{style}.svg'
    (ROOT/'svg'/name).write_text(svg('wordmark',style),encoding='utf-8')
    files.append(name)
(ROOT/'svg'/'talea-app-icon.svg').write_text(svg('app'),encoding='utf-8')
files.append('talea-app-icon.svg')
manifest={'brand':'talea','palette':COLORS,'svg_files':files,'source':'Selected user-provided design, reconstructed as clean vector paths; no embedded raster image or font dependency. The wordmark is a clean reconstruction of the selected lettering.','wordmark_bounds':word_bounds,'art_bounds':art_bounds,'small_icon':'Thin page turn removed; facial paths enlarged by 8%.','monochrome':'Face and page spaces are transparent; features and book use a single solid ink colour.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'source'/'vector-paths.json').write_text(json.dumps({'main':outer_path,'cream_face':face_path,'cream_page':page_path,'face_features':face_features(COLORS['ink']),'wordmark_glyphs':{'t':t_glyph,'a':a_glyph,'l':l_glyph,'e':e_glyph,'second_a_translate_x':322}},indent=2),encoding='utf-8')
print(json.dumps({'svg_count':len(files),'wordmark_bounds':word_bounds,'cream_regions':[round(abs(area(p))) for p in face_loops],'feature_regions':len(outlines(features_mask,50))}))
