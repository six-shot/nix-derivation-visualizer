{ nixpkgs ? import <nixpkgs> {} }:

let
  pkgs = nixpkgs;
  src = ./nix-derivative-frontend/nix-derivative-frontend;  
     inherit (pkgs)  buildNpmPackage importNpmLock;
     inherit(pkgs) python3Packages;
     inherit(python3Packages) buildPythonPackage;

in
{
  frontend = buildNpmPackage {
    pname = "frontend";
    version = "0.0.0";

    inherit src;

    npmDeps = pkgs.importNpmLock {
      npmRoot = src;
    };

    npmConfigHook = pkgs.importNpmLock.npmConfigHook;
  };
    backend = buildPythonPackage {
            pname = "backend";
             version = "0.0.0";
             pyproject = true;
             src = ./nix-derivation-visualizer;
             build-system = [
              pkgs.python3Packages.setuptools
        ];
                dependencies =  with python3Packages;  [
            flask
            networkx
            pydot
            flask-cors
        ];

        
    };
}

