struct FragmentInput {
  @location(0) normal: vec3f,
  @location(1) color: vec4f,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4f {
  // Simple lighting with normal
  let light = normalize(vec3f(1.0, 1.0, 1.0));
  let diffuse = max(dot(normalize(input.normal), light), 0.3);

  return vec4f(input.color.rgb * diffuse, input.color.a);
}
