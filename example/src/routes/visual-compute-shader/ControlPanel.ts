import GUI from "lil-gui";

export interface GraphControlsParams {
  nodeCount: number;
  running: boolean;
  repulsionStrength: number;
  centerGravity: number;
  damping: number;
  spaceScale: number;
  nodeSize: number;
  showIllicit: boolean;
  showLicit: boolean;
  showUnknown: boolean;
}

export interface GraphControlsCallbacks {
  onNodeCountChange: (count: number) => void;
  onSpaceScaleChange: (scale: number) => void;
  onNodeSizeChange: (size: number) => void;
}

export class ControlPanel {
  /**
   * Create control panel with lil-gui
   */
  static createGraphControls(
    params: GraphControlsParams,
    callbacks: GraphControlsCallbacks
  ): GUI {
    const gui = new GUI({ title: "Elliptic Graph Controls" });

    // Simulation controls
    const simFolder = gui.addFolder("Simulation");
    simFolder
      .add(params, "nodeCount", 1000, 203771, 1000)
      .name("Node Count")
      .onFinishChange(callbacks.onNodeCountChange);
    simFolder.add(params, "running").name("Running");
    simFolder
      .add(params, "spaceScale", 0.5, 10, 0.1)
      .name("Space")
      .onFinishChange(callbacks.onSpaceScaleChange);
    simFolder
      .add(params, "repulsionStrength", 0.001, 0.5, 0.001)
      .name("Repulsion");
    simFolder
      .add(params, "centerGravity", 0.001, 0.1, 0.001)
      .name("Center Gravity");
    simFolder.add(params, "damping", 0.8, 0.99, 0.01).name("Damping");
    simFolder.open();

    // Visual controls
    const visualFolder = gui.addFolder("Visual");
    visualFolder
      .add(params, "nodeSize", 0.005, 0.05, 0.001)
      .name("Node Size")
      .onChange(callbacks.onNodeSizeChange);
    visualFolder.open();

    // Filter controls
    const filterFolder = gui.addFolder("Filters");
    filterFolder.add(params, "showIllicit").name("Show Illicit (Red)");
    filterFolder.add(params, "showLicit").name("Show Licit (Green)");
    filterFolder.add(params, "showUnknown").name("Show Unknown (Gray)");
    filterFolder.open();

    return gui;
  }
}
