import networkx as nx
import json

# Load the Graphviz .dot file
dot_file = "graph.dot"
graph = nx.nx_pydot.read_dot(dot_file)

# Convert to a format suitable for D3.js (nodes & links)
nodes = [{"id": node} for node in graph.nodes()]
links = [{"source": u, "target": v} for u, v in graph.edges()]

# Save to JSON
output = {"nodes": nodes, "links": links}
with open("graph.json", "w") as f:
    json.dump(output, f, indent=4)

print("Converted graph.dot to graph.json successfully!")