import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as THREE from "three";
import {
  siInstagram,
  siYoutube,
  siTelegram,
  siTiktok,
  siFacebook,
  siX,
} from "simple-icons";

const LOGOS = {
  instagram: siInstagram,
  youtube: siYoutube,
  telegram: siTelegram,
  tiktok: siTiktok,
  facebook: siFacebook,
  x: siX,
};

for (const [name, icon] of Object.entries(LOGOS)) {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}"/></svg>`;
    const data = new SVGLoader().parse(svg);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 3,
      curveSegments: 24,
    });
    geo.center();
    const s = (1.0 / 24) * 0.95;
    geo.scale(s, -s, s);
    geo.computeVertexNormals();

    const vertexCount = geo.attributes.position.count;
    const shapeCount = shapes.length;
    const holeCount = shapes.reduce((acc, s) => acc + s.holes.length, 0);

    console.log(`Logo: ${name} -> Vertices: ${vertexCount}, Shapes: ${shapeCount}, Holes: ${holeCount}`);
  } catch (err) {
    console.error(`Error parsing logo ${name}:`, err);
  }
}
