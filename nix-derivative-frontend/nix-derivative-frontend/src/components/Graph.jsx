import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

// Function to detect communities using a simple connected components approach
const detectCommunities = (nodes, links) => {
  const communities = new Map();
  const visited = new Set();

  const dfs = (nodeId, communityId) => {
    visited.add(nodeId);
    communities.set(nodeId, communityId);

    // Find all connected nodes
    links.forEach((link) => {
      if (link.source.id === nodeId && !visited.has(link.target.id)) {
        dfs(link.target.id, communityId);
      }
      if (link.target.id === nodeId && !visited.has(link.source.id)) {
        dfs(link.source.id, communityId);
      }
    });
  };

  let communityId = 0;
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      dfs(node.id, communityId);
      communityId++;
    }
  });

  return communities;
};

const DerivationGraph = () => {
  const svgRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [clusters, setClusters] = useState(null);

  useEffect(() => {
    fetch("/graph.json")
      .then((response) => response.json())
      .then((data) => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3
          .select(svgRef.current)
          .attr("viewBox", `0 0 ${width} ${height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");
        svg.selectAll("*").remove();

        // Enable zoom & pan
        const zoom = d3
          .zoom()
          .scaleExtent([0.1, 5])
          .on("zoom", (event) => {
            g.attr("transform", event.transform);
            setZoomLevel(event.transform.k);
          });

        svg.call(zoom);

        const g = svg.append("g");

        // Detect communities
        const communities = detectCommunities(data.nodes, data.links);

        // Create cluster nodes
        const clusterNodes = [];
        const clusterLinks = [];
        const clusterMap = new Map();

        // Group nodes by community
        communities.forEach((communityId, nodeId) => {
          if (!clusterMap.has(communityId)) {
            clusterMap.set(communityId, {
              id: `cluster-${communityId}`,
              nodes: [],
              size: 0,
            });
          }
          clusterMap.get(communityId).nodes.push(nodeId);
          clusterMap.get(communityId).size++;
        });

        // Create cluster nodes
        clusterMap.forEach((cluster, id) => {
          clusterNodes.push({
            id: cluster.id,
            size: cluster.size,
            nodes: cluster.nodes,
            isCluster: true,
          });
        });

        // Create links between clusters
        data.links.forEach((link) => {
          const sourceCluster = communities.get(link.source.id);
          const targetCluster = communities.get(link.target.id);

          if (sourceCluster !== targetCluster) {
            clusterLinks.push({
              source: `cluster-${sourceCluster}`,
              target: `cluster-${targetCluster}`,
            });
          }
        });

        // Combine original nodes with cluster nodes
        const allNodes = [...data.nodes, ...clusterNodes];
        const allLinks = [...data.links, ...clusterLinks];

        const link = g
          .selectAll(".link")
          .data(allLinks)
          .enter()
          .append("line")
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", 1);

        const node = g
          .selectAll(".node")
          .data(allNodes)
          .enter()
          .append("g")
          .attr("class", "node")
          .call(
            d3
              .drag()
              .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              })
          );

        // Different visual representation for clusters
        node
          .append("circle")
          .attr("r", (d) => (d.isCluster ? Math.sqrt(d.size) * 2 : 5))
          .attr("fill", (d) => (d.isCluster ? "#ff7f0e" : "steelblue"));

        // Modify node text display while keeping full IDs for layout
        node
          .append("text")
          .text((d) => {
            // Display simplified name but keep full ID for internal use
            const displayName = d.isCluster
              ? `Cluster (${d.size})`
              : d.id.split("-")[0]; // Show only the derivation name without hash
            return displayName;
          })
          .attr("x", (d) => (d.isCluster ? 12 : 8))
          .attr("y", 3)
          .style("font-size", (d) => (d.isCluster ? "14px" : "12px"))
          .style("fill", "#333");

        const simulation = d3
          .forceSimulation(allNodes)
          .force(
            "link",
            d3
              .forceLink(allLinks)
              .id((d) => d.id)
              .distance((d) => (d.isCluster ? 100 : 50))
          )
          .force("charge", d3.forceManyBody().strength(-200))
          .force("center", d3.forceCenter(width / 2, height / 2));

        simulation.on("tick", () => {
          link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

          node.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
        });

        // Store clusters for later use
        setClusters(clusterMap);

        // Resize on window change
        window.addEventListener("resize", () => {
          const newWidth = window.innerWidth;
          const newHeight = window.innerHeight;
          svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);
          simulation.force(
            "center",
            d3.forceCenter(newWidth / 2, newHeight / 2)
          );
          simulation.alpha(1).restart();
        });
      });
  }, []);

  return <svg ref={svgRef} style={{ width: "100vw", height: "100vh" }}></svg>;
};

export default DerivationGraph;
