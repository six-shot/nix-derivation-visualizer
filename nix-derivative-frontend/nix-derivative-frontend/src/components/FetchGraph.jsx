import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

function FetchGraph() {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [focusedNode, setFocusedNode] = useState(null);
  const [depth, setDepth] = useState(1);
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

  useEffect(() => {
    if (!graphData) return;

    d3.select(svgRef.current).selectAll("*").remove();

    // Get the actual dimensions of the container
    const container = svgRef.current.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Update the SVG dimensions
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Update the tree layout dimensions
    const treeLayout = d3.tree().size([height - 100, width - 200]); // Note: swapped dimensions for horizontal layout

    // Create hierarchical layout
    const stratify = d3
      .stratify()
      .id((d) => d.id)
      .parentId((d) => d.parent);

    // Transform flat data into hierarchical view
    const processDataForHierarchy = (
      nodes,
      links,
      focusNode = null,
      maxDepth = 1
    ) => {
      if (!focusNode) {
        // Find root node (node with no incoming edges)
        const hasIncoming = new Set(links.map((l) => l.target));
        focusNode = nodes.find((n) => !hasIncoming.has(n.id))?.id;
      }

      const seen = new Set();
      const result = [];
      const traverse = (nodeId, depth = 0, parent = null) => {
        if (depth > maxDepth || seen.has(nodeId)) return;
        seen.add(nodeId);

        result.push({
          id: nodeId,
          parent: parent,
          depth: depth,
        });

        links
          .filter((l) => l.source === nodeId)
          .forEach((l) => traverse(l.target, depth + 1, nodeId));
      };

      traverse(focusNode);
      return result;
    };

    const hierarchicalData = processDataForHierarchy(
      graphData.nodes,
      graphData.links,
      focusedNode,
      depth
    );

    const root = stratify(hierarchicalData);

    const g = svg.append("g").attr("transform", `translate(50, 50)`);

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    const nodes = treeLayout(root);

    // Draw links
    g.selectAll("path.link")
      .data(nodes.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((d) => d.y) // Swap x and y for horizontal layout
          .y((d) => d.x)
      );

    // Create node groups
    const node = g
      .selectAll("g.node")
      .data(nodes.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`); // Swap x and y

    // Add node circles
    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d) => {
        if (d.data.id.endsWith(".drv")) return "#4CAF50";
        if (d.data.id.endsWith(".patch")) return "#FFA726";
        return "#2196F3";
      });

    // Add node labels
    node
      .append("text")
      .attr("dy", "0.31em")
      .attr("x", (d) => (d.children ? -8 : 8))
      .attr("text-anchor", (d) => (d.children ? "end" : "start"))
      .text((d) => {
        const name = d.data.id.split("-").pop();
        return name.length > 20 ? name.substring(0, 20) + "..." : name;
      })
      .on("mouseover", (event, d) => {
        // Show full name on hover
        d3.select(event.currentTarget.parentNode)
          .append("title")
          .text(d.data.id);
      });

    // Add click handlers
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
        padding: "20px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <button
          onClick={loadGraph}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Load Graph
        </button>
        <div>
          <label>Depth: </label>
          <input
            type="range"
            min="1"
            max="5"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          />
          <span>{depth}</span>
        </div>
        <button
          onClick={() => setFocusedNode(null)}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset Focus
        </button>
      </div>
      {error && (
        <div style={{ color: "red", marginBottom: "10px" }}>Error: {error}</div>
      )}
      <div
        style={{
          flex: 1,
          border: "1px solid #ccc",
          borderRadius: "4px",
          overflow: "hidden",
          backgroundColor: "#fff",
          position: "relative",
        }}
      >
        <svg
          ref={svgRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </div>
      <div style={{ marginTop: "10px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: "#4CAF50",
                borderRadius: "50%",
              }}
            ></span>
            <span>Derivation</span>
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
            <span>Patch</span>
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
    </div>
  );
}

export default FetchGraph;
