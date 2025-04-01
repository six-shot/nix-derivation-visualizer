import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

function FetchGraph() {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [depth, setDepth] = useState(3);
  const [searchTerm, setSearchTerm] = useState("");
  const svgRef = useRef();

  async function fetchGraphData(nixExpression) {
    try {
      const response = await fetch("http://localhost:5000/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nix_expression: nixExpression }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Network response was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching graph data:", error);
      throw error;
    }
  }

  const findRootNodes = (nodes, links) => {
    const hasIncoming = new Set(links.map((l) => l.target));
    return nodes.filter((n) => !hasIncoming.has(n.id));
  };

  useEffect(() => {
    if (!graphData) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const container = svgRef.current.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 4, height / 2));

    // Process data for tree layout
    const processData = (
      nodes,
      links,
      focusNode = null,
      maxDepth = Infinity
    ) => {
      const rootNode = focusNode || findRootNodes(nodes, links)[0]?.id;
      if (!rootNode) return [];

      const seen = new Set();
      const result = [];

      const traverse = (nodeId, depth = 0, parent = null) => {
        if (depth > maxDepth || seen.has(nodeId)) return;
        seen.add(nodeId);

        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        result.push({
          id: nodeId,
          parent: parent,
          depth: depth,
          name: node.id.split("-").pop(),
          fullName: node.id,
        });

        // Get all dependencies
        links
          .filter((l) => l.source === nodeId)
          .forEach((l) => traverse(l.target, depth + 1, nodeId));
      };

      traverse(rootNode);
      return result;
    };

    const treeData = processData(
      graphData.nodes,
      graphData.links,
      focusedNode,
      depth
    );

    const stratify = d3
      .stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent);

    const root = stratify(treeData);

    // Create tree layout
    const treeLayout = d3.tree().size([height - 100, width - 300]);

    const nodes = treeLayout(root);

    // Draw links
    g.selectAll("path.link")
      .data(nodes.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((d) => d.y)
          .y((d) => d.x)
      );

    // Create node groups
    const node = g
      .selectAll("g.node")
      .data(nodes.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    // Add node circles
    node
      .append("circle")
      .attr("r", 6)
      .attr("fill", (d) => {
        if (d.data.fullName.endsWith(".drv")) return "#4CAF50";
        if (d.data.fullName.endsWith(".patch")) return "#FFA726";
        if (d.data.fullName.endsWith(".sh")) return "#9C27B0";
        return "#2196F3";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add node labels
    node
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d) => (d.children ? -8 : 8))
      .attr("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => d.data.name)
      .style("font-size", "12px")
      .style("font-family", "monospace")
      .on("mouseover", (event, d) => {
        // Show tooltip with full name
        const tooltip = svg
          .append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${d.y},${d.x - 20})`);

        tooltip
          .append("rect")
          .attr("x", -3)
          .attr("y", -25)
          .attr("width", d.data.fullName.length * 7)
          .attr("height", 20)
          .attr("fill", "black")
          .attr("opacity", 0.8)
          .attr("rx", 3);

        tooltip
          .append("text")
          .attr("x", 0)
          .attr("y", -10)
          .text(d.data.fullName)
          .attr("fill", "white")
          .style("font-size", "10px");
      })
      .on("mouseout", () => {
        svg.selectAll(".tooltip").remove();
      });

    // Add click handler
    node.on("click", (event, d) => {
      setFocusedNode(d.data.id);
    });
  }, [graphData, focusedNode, depth]);

  const nixpkgsExpression = `
    let
      pkgs = import <nixpkgs> {};
    in
      pkgs.hello
  `;

  const loadGraph = async () => {
    try {
      const data = await fetchGraphData(nixpkgsExpression);
      setGraphData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: "10px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
          backgroundColor: "white",
          borderBottom: "1px solid #ccc",
        }}
      >
        <button onClick={loadGraph}>Load Graph</button>
        <div>
          <label>Depth: </label>
          <input
            type="range"
            min="1"
            max="10"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
          <span>{depth}</span>
        </div>
        <button onClick={() => setFocusedNode(null)}>Reset Focus</button>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      </div>
      <div
        style={{
          padding: "10px",
          backgroundColor: "white",
          borderTop: "1px solid #ccc",
          display: "flex",
          gap: "20px",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#4CAF50",
              borderRadius: "50%",
            }}
          ></span>
          <span>Derivation (.drv)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#FFA726",
              borderRadius: "50%",
            }}
          ></span>
          <span>Patch (.patch)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#9C27B0",
              borderRadius: "50%",
            }}
          ></span>
          <span>Shell Script (.sh)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: "#2196F3",
              borderRadius: "50%",
            }}
          ></span>
          <span>Other</span>
        </div>
      </div>
    </div>
  );
}

export default FetchGraph;
