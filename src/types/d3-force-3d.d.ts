declare module 'd3-force-3d' {
  export interface SimulationNodeDatum {
    index?: number
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    fx?: number | null
    fy?: number | null
    fz?: number | null
  }

  export interface SimulationLinkDatum<Node extends SimulationNodeDatum> {
    source: Node | string
    target: Node | string
  }

  interface Simulation<Node extends SimulationNodeDatum> {
    stop(): Simulation<Node>
    tick(): Simulation<Node>
    force(name: string, force: unknown): Simulation<Node>
  }

  interface LinkForce<Node extends SimulationNodeDatum, Link extends SimulationLinkDatum<Node>> {
    id(accessor: (node: Node) => string): LinkForce<Node, Link>
    distance(accessor: (link: Link) => number): LinkForce<Node, Link>
    strength(accessor: (link: Link) => number): LinkForce<Node, Link>
  }

  interface ManyBodyForce {
    strength(accessor: (node: SimulationNodeDatum) => number): ManyBodyForce
  }

  interface CollideForce<Node extends SimulationNodeDatum> {
    radius(accessor: (node: Node) => number): CollideForce<Node>
  }

  export function forceSimulation<Node extends SimulationNodeDatum>(nodes: Node[], dimensions?: number): Simulation<Node>
  export function forceLink<Node extends SimulationNodeDatum, Link extends SimulationLinkDatum<Node>>(links: Link[]): LinkForce<Node, Link>
  export function forceManyBody(): ManyBodyForce
  export function forceCenter(x?: number, y?: number, z?: number): unknown
  export function forceCollide<Node extends SimulationNodeDatum>(): CollideForce<Node>
}
