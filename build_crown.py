"""Procedural faceted glass crown -> crown.glb (no third-party libs, numpy only).
Geometry follows the reference: 8 spikes in a ring (3 front, 5 back/side),
vertical centre edge on every spike running down the faceted bowl to one apex.
Meshes in the GLB: "glass" (flat-shaded triangles), "core" (dark inner cup),
"edges" (line segments, for the glowing lime outline)."""
import json, struct, numpy as np

N = 8                      # spikes
R_OUT, R_IN = 1.00, 0.80   # outer / inner wall radius at the rim
H = 0.50                   # spike height above rim
LEAN = 1.05                # tip radius factor (outward lean)
BOWL = [(0.88, -0.36), (0.52, -0.72)]  # (radius, y) rings below rim
APEX_Y = -0.92

def pt(r, a, y):           # a in radians, 0 = front (+Z)
    return np.array([r*np.sin(a), y, r*np.cos(a)], dtype=np.float32)

step = 2*np.pi/N
ang16 = [i*step/2 for i in range(2*N)]          # even = spike angle, odd = valley
v  = [pt(R_OUT, a, 0.0) for a in ang16]          # outer rim ring (16)
w  = [pt(R_IN,  a, 0.0) for a in ang16]          # inner rim ring (16)
r1 = [pt(BOWL[0][0], a, BOWL[0][1]) for a in ang16]       # ring 1 (16)
r2 = [pt(BOWL[1][0], k*step, BOWL[1][1]) for k in range(N)]  # ring 2 (8)
apex = np.array([0, APEX_Y, 0], dtype=np.float32)
tip = [pt(R_OUT*LEAN, k*step, H) for k in range(N)]

tris = []
M = 2*N
for k in range(N):
    a, b, c = (2*k-1) % M, (2*k) % M, (2*k+1) % M
    T = tip[k]
    # spike outer faces (centre edge T-v[b] continues into the bowl)
    tris += [(T, v[a], v[b]), (T, v[b], v[c])]
    # spike inner faces + closing sides
    tris += [(T, w[c], w[b]), (T, w[b], w[a])]
    tris += [(T, v[a], w[a]), (T, w[c], v[c])]
    # bowl: rim -> ring1
    for i in (a, b):
        pass
for i in range(M):
    j = (i+1) % M
    tris += [(v[i], v[j], r1[j]), (v[i], r1[j], r1[i])]
for k in range(N):
    a, b, c = (2*k-1) % M, (2*k) % M, (2*k+1) % M
    v2, v2n = r2[k], r2[(k+1) % N]
    tris += [(r1[a], r1[b], v2), (r1[b], r1[c], v2), (r1[c], v2n, v2)]
    tris += [(r2[k], r2[(k+1) % N], apex)]
tris = [tuple(t) for t in tris]

centre = np.array([0, -0.15, 0], dtype=np.float32)
pos, nrm = [], []
for t in tris:
    n = np.cross(t[1]-t[0], t[2]-t[0]); l = np.linalg.norm(n)
    if l < 1e-9: continue
    n = n/l
    if np.dot(n, (t[0]+t[1]+t[2])/3 - centre) < 0 and np.linalg.norm(((t[0]+t[1]+t[2])/3)[[0,2]]) > 0.0:
        pass  # keep as built; material is DoubleSide, normals only affect lighting
    pos += list(t); nrm += [n]*3
pos = np.array(pos, dtype=np.float32); nrm = np.array(nrm, dtype=np.float32)

# edges: unique triangle edges
def is_w(p): return abs(np.hypot(p[0], p[2]) - R_IN) < 1e-3
seen, edges = set(), []
for t in tris:
    for p, q in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        if abs(p[1]) < 1e-6 and abs(q[1]) < 1e-6 and (is_w(p) or is_w(q)): continue  # hide inner rim ring / side seams
        key = tuple(sorted([tuple(np.round(p, 4)), tuple(np.round(q, 4))]))
        if key in seen: continue
        seen.add(key); edges += [p, q]
edges = np.array(edges, dtype=np.float32)

# dark inner core: a smaller closed cup
core = []
s = 0.86
cv = [pt(R_IN*s*1.05, a, 0.0) for a in ang16]
cr1 = [p*np.array([s, 0.9, s], dtype=np.float32) for p in r1]
cr2 = [p*np.array([s, 0.9, s], dtype=np.float32) for p in r2]
cap = np.array([0, 0.0, 0], dtype=np.float32); capa = apex*np.array([0, 0.9, 0], dtype=np.float32)
for i in range(M):
    j = (i+1) % M
    core += [(cap, cv[i], cv[j]), (cv[i], cr1[i], cr1[j]), (cv[i], cr1[j], cv[j])]
for k in range(N):
    a, b, c = (2*k-1) % M, (2*k) % M, (2*k+1) % M
    core += [(cr1[a], cr1[b], cr2[k]), (cr1[b], cr1[c], cr2[k]), (cr1[c], cr2[(k+1) % N], cr2[k]), (cr2[k], cr2[(k+1) % N], capa)]
cpos = np.array([p for t in core for p in t], dtype=np.float32)
cn = []
for i in range(0, len(cpos), 3):
    n = np.cross(cpos[i+1]-cpos[i], cpos[i+2]-cpos[i]); l = np.linalg.norm(n)
    cn += [n/l if l > 1e-9 else np.array([0, 1, 0], dtype=np.float32)]*3
cnrm = np.array(cn, dtype=np.float32)

# ---- write GLB ----
blobs, views, accs = [], [], []
def add(arr, target=None):
    data = arr.astype(np.float32).tobytes()
    off = sum(len(b) for b in blobs)
    blobs.append(data + b'\x00'*((4-len(data) % 4) % 4))
    views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), **({"target": target} if target else {})})
    accs.append({"bufferView": len(views)-1, "componentType": 5126, "count": len(arr), "type": "VEC3",
                 "min": arr.min(0).tolist(), "max": arr.max(0).tolist()})
    return len(accs)-1
gp, gn = add(pos, 34962), add(nrm, 34962)
cpi, cni = add(cpos, 34962), add(cnrm, 34962)
ep = add(edges, 34962)
gltf = {
 "asset": {"version": "2.0", "generator": "build_crown.py"},
 "scene": 0, "scenes": [{"nodes": [0]}],
 "nodes": [{"name": "Crown", "children": [1, 2, 3]},
           {"name": "core", "mesh": 1}, {"name": "glass", "mesh": 0}, {"name": "edges", "mesh": 2}],
 "meshes": [
  {"name": "glass", "primitives": [{"attributes": {"POSITION": gp, "NORMAL": gn}, "material": 0, "mode": 4}]},
  {"name": "core",  "primitives": [{"attributes": {"POSITION": cpi, "NORMAL": cni}, "material": 1, "mode": 4}]},
  {"name": "edges", "primitives": [{"attributes": {"POSITION": ep}, "material": 2, "mode": 1}]}],
 "materials": [
  {"name": "glass", "doubleSided": True, "alphaMode": "BLEND",
   "pbrMetallicRoughness": {"baseColorFactor": [0.86, 0.94, 0.56, 0.45], "metallicFactor": 0.0, "roughnessFactor": 0.25}},
  {"name": "core", "pbrMetallicRoughness": {"baseColorFactor": [0.035, 0.07, 0.0, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.9}},
  {"name": "edges", "emissiveFactor": [0.86, 0.94, 0.56], "pbrMetallicRoughness": {"baseColorFactor": [0.86, 0.94, 0.56, 1.0]}}],
 "accessors": accs, "bufferViews": views,
 "buffers": [{"byteLength": sum(len(b) for b in blobs)}]}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' '*((4-len(js) % 4) % 4)
bin_ = b''.join(blobs)
total = 12 + 8 + len(js) + 8 + len(bin_)
with open('crown.glb', 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
    f.write(struct.pack('<I4s', len(bin_), b'BIN\x00')); f.write(bin_)
print('glass tris', len(pos)//3, 'core tris', len(cpos)//3, 'edges', len(edges)//2, 'bytes', total)
