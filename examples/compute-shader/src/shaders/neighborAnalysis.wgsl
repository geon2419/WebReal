// nodeClasses: 0=unknown, 1=licit, 2=illicit
@group(0) @binding(0) var<storage, read> nodeClasses: array<u32>;
// edges: pairs of (srcIdx, dstIdx)
@group(0) @binding(1) var<storage, read> edges: array<u32>;
// results: per-node counters [total, illicit, licit, unknown]
@group(0) @binding(2) var<storage, read_write> results: array<atomic<u32>>;
// params: (nodeCount, edgeCount)
@group(0) @binding(3) var<uniform> params: vec2<u32>;

fn accumulate(nodeIdx: u32, neighborClass: u32) {
  let base = nodeIdx * 4u;
  _ = atomicAdd(&results[base], 1u);
  if (neighborClass == 2u) {
    _ = atomicAdd(&results[base + 1u], 1u);
  } else if (neighborClass == 1u) {
    _ = atomicAdd(&results[base + 2u], 1u);
  } else {
    _ = atomicAdd(&results[base + 3u], 1u);
  }
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let edgeIdx = globalId.x;
  let nodeCount = params.x;
  let edgeCount = params.y;

  if (edgeIdx >= edgeCount) {
    return;
  }

  let src = edges[edgeIdx * 2u];
  let dst = edges[edgeIdx * 2u + 1u];

  // Defensive checks (should already be mapped/compacted on CPU)
  if (src >= nodeCount || dst >= nodeCount) {
    return;
  }

  accumulate(src, nodeClasses[dst]);
  accumulate(dst, nodeClasses[src]);
}
