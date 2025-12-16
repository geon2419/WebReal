struct Node {
  position: vec3<f32>,
  padding: f32,
  color: vec4<f32>,
};

struct Params {
  repulsionStrength: f32,
  centerGravity: f32,
  damping: f32,
  deltaTime: f32,
  nodeCount: u32,
  bounds: vec3<f32>,
};

@group(0) @binding(0) var<storage, read_write> nodes: array<Node>;
@group(0) @binding(1) var<uniform> params: Params;

// Simple force-directed layout
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= params.nodeCount) { return; }

  var force = vec3<f32>(0.0, 0.0, 0.0);
  let pos_i = nodes[i].position;

  // Repulsion (sampled) - avoids O(N^2)
  let samples = min(128u, params.nodeCount);
  var seed = i * 1664525u + 1013904223u;
  for (var k = 0u; k < samples; k++) {
    seed = seed * 1664525u + 1013904223u;
    let j = seed % params.nodeCount;
    if (i == j) { continue; }

    let pos_j = nodes[j].position;
    let delta = pos_i - pos_j;
    let dist_sq = max(dot(delta, delta), 0.01);
    let dist = sqrt(dist_sq);

    force += (delta / dist) * (params.repulsionStrength / dist_sq);
  }

  // Center gravity (pull towards origin)
  force -= pos_i * params.centerGravity;

  // Update position with damping
  var new_pos = pos_i + force * params.deltaTime;
  new_pos *= params.damping;

  // Clamp to user-controlled bounds
  let b = params.bounds;
  new_pos = clamp(new_pos, -b, b);

  nodes[i].position = new_pos;
}
