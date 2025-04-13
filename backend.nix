{ buildPythonPackage, setuptools, flask, networkx, pydot, flask-cors }:

buildPythonPackage {
  pname = "backend";
  version = "0.0.0";
  pyproject = true;
  src = ./nix-derivation-visualizer;
  build-system = [ setuptools ];
  propagatedBuildInputs = [ flask networkx pydot flask-cors ];
  meta.mainProgram = "drv-visualizer-backend";
}
