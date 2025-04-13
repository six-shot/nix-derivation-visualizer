{ nixpkgs ? import <nixpkgs> { } }:

let
  pkgs = nixpkgs;
  inherit (pkgs) lib;

  # Create a new scope for our packages
  visualizerScope = lib.makeScope pkgs.newScope (self: {
    # Add getExe from pkgs.lib
    inherit (pkgs.lib) getExe;
    
    # Python packages scope
    pythonScope = lib.makeScope pkgs.python3Packages.newScope (pyself: {
      backend = pyself.callPackage ./backend.nix { };
    });

    # Import packages using callPackage
    inherit (self.pythonScope) backend;
    frontend = self.callPackage ./frontend.nix { };
    vm = self.callPackage ./vm.nix { };
  });

in
  visualizerScope