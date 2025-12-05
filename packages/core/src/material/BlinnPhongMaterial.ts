import { Color } from "@web-real/math";
import type { Material, VertexBufferLayout } from "./Material";

export interface BlinnPhongMaterialOptions {
  color?: [number, number, number] | Color;
  shininess?: number;
}

export class BlinnPhongMaterial implements Material {
  readonly type = "blinnPhong";
  /** RGBA color (Color instance, 0-1 range) */
  readonly color: Color;
  /** Shininess exponent for specular highlight (higher = sharper) */
  shininess: number;

  constructor(options: BlinnPhongMaterialOptions = {}) {
    this.color = options.color
      ? Color.from(options.color)
      : new Color(1.0, 1.0, 1.0);
    this.shininess = options.shininess ?? 32.0;
  }

  getVertexShader(): string {
    return /* wgsl */ `
struct Uniforms {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  colorAndShininess: vec4f,
  lightDirection: vec4f,
  lightColor: vec4f,
  cameraPosition: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPosition: vec3f,
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4f(input.position, 1.0);
  // Transform normal to world space (assuming uniform scale)
  output.normal = (uniforms.modelMatrix * vec4f(input.normal, 0.0)).xyz;
  // Calculate world position for specular
  output.worldPosition = (uniforms.modelMatrix * vec4f(input.position, 1.0)).xyz;
  return output;
}
`;
  }

  getFragmentShader(): string {
    return /* wgsl */ `
struct Uniforms {
  mvpMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  colorAndShininess: vec4f,
  lightDirection: vec4f,
  lightColor: vec4f,
  cameraPosition: vec4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) normal: vec3f,
  @location(1) worldPosition: vec3f,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  let normal = normalize(input.normal);
  let lightDir = normalize(-uniforms.lightDirection.xyz);
  let viewDir = normalize(uniforms.cameraPosition.xyz - input.worldPosition);
  
  // Ambient
  let ambient = 0.1;
  
  // Diffuse (Lambertian)
  let NdotL = max(dot(normal, lightDir), 0.0);
  let diffuse = NdotL * uniforms.lightColor.rgb * uniforms.lightColor.a;
  
  // Specular (Blinn-Phong)
  let halfVector = normalize(lightDir + viewDir);
  let NdotH = max(dot(normal, halfVector), 0.0);
  let shininess = uniforms.colorAndShininess.a;
  let specular = pow(NdotH, shininess) * uniforms.lightColor.rgb * uniforms.lightColor.a;
  
  // Final color
  let materialColor = uniforms.colorAndShininess.rgb;
  let finalColor = materialColor * (ambient + diffuse) + specular;
  
  return vec4f(finalColor, 1.0);
}
`;
  }

  getVertexBufferLayout(): VertexBufferLayout {
    return {
      // position(vec3f) + normal(vec3f) = 6 floats × 4 bytes = 24 bytes
      arrayStride: 24,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3", // position
        },
        {
          shaderLocation: 1,
          offset: 12,
          format: "float32x3", // normal
        },
      ],
    };
  }

  // Layout: mat4x4f mvp (64B) + mat4x4f model (64B) + vec4f colorAndShininess (16B) + vec4f lightDir (16B) + vec4f lightColor (16B) + vec4f cameraPosition (16B) = 192 bytes
  getUniformBufferSize(): number {
    return 192;
  }

  getPrimitiveTopology(): GPUPrimitiveTopology {
    return "triangle-list";
  }

  /**
   * Writes material-specific uniform data (color + shininess) to the buffer.
   * MVP matrix should be written separately at offset 0.
   * Model matrix should be written at offset 64.
   * Light data should be written by the Renderer.
   * @param buffer - DataView of the uniform buffer
   * @param offset - Byte offset to start writing (default: 128, after MVP + Model matrices)
   */
  writeUniformData(buffer: DataView, offset: number = 128): void {
    buffer.setFloat32(offset, this.color.r, true);
    buffer.setFloat32(offset + 4, this.color.g, true);
    buffer.setFloat32(offset + 8, this.color.b, true);
    buffer.setFloat32(offset + 12, this.shininess, true);
  }
}
