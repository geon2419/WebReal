// Basic shader
import basicVert from "./basic/basic.vert.wgsl";
import basicFrag from "./basic/basic.frag.wgsl";

// BlinnPhong shader
import blinnPhongVert from "./blinnPhong/blinnPhong.vert.wgsl";
import blinnPhongFrag from "./blinnPhong/blinnPhong.frag.wgsl";

// VertexColor shader
import vertexColorVert from "./vertexColor/vertexColor.vert.wgsl";
import vertexColorFrag from "./vertexColor/vertexColor.frag.wgsl";

// Line shader
import lineVert from "./line/line.vert.wgsl";
import lineFrag from "./line/line.frag.wgsl";

// LineColor shader
import lineColorVert from "./lineColor/lineColor.vert.wgsl";
import lineColorFrag from "./lineColor/lineColor.frag.wgsl";

// Texture shader
import textureVert from "./texture/texture.vert.wgsl";
import textureFrag from "./texture/texture.frag.wgsl";

// Parallax shader
import parallaxVert from "./parallax/parallax.vert.wgsl";
import parallaxFrag from "./parallax/parallax.frag.wgsl";

// ParallaxPBR shader
import parallaxPbrVert from "./parallaxPbr/parallaxPbr.vert.wgsl";
import parallaxPbrFrag from "./parallaxPbr/parallaxPbr.frag.wgsl";

// PBR shader
import pbrVert from "./pbr/pbr.vert.wgsl";
import pbrFrag from "./pbr/pbr.frag.wgsl";

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

const shaders: Record<string, ShaderSource> = {
  basic: {
    vertex: basicVert,
    fragment: basicFrag,
  },
  blinnPhong: {
    vertex: blinnPhongVert,
    fragment: blinnPhongFrag,
  },
  vertexColor: {
    vertex: vertexColorVert,
    fragment: vertexColorFrag,
  },
  line: {
    vertex: lineVert,
    fragment: lineFrag,
  },
  lineColor: {
    vertex: lineColorVert,
    fragment: lineColorFrag,
  },
  texture: {
    vertex: textureVert,
    fragment: textureFrag,
  },
  parallax: {
    vertex: parallaxVert,
    fragment: parallaxFrag,
  },
  parallaxPbr: {
    vertex: parallaxPbrVert,
    fragment: parallaxPbrFrag,
  },
  pbr: {
    vertex: pbrVert,
    fragment: pbrFrag,
  },
};

export const ShaderLib = {
  /**
   * Get shader source by material type name.
   * @param name - Material type name (e.g., "basic", "blinnPhong")
   * @returns ShaderSource containing vertex and fragment shader code
   * @throws Error if shader not found
   */
  get(name: string): ShaderSource {
    const shader = shaders[name];
    if (!shader) {
      throw new Error(`Shader not found: ${name}`);
    }
    return shader;
  },

  /**
   * Check if shader exists by name.
   * @param name - Material type name
   */
  has(name: string): boolean {
    return name in shaders;
  },
};
