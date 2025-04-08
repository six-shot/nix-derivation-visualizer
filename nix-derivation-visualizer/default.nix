let
  src = ./nix-derivative-frontend/nix-derivative-frontend;
in
buildNpmPackage {
  pname = "frontend";
  version = "0.0.0";

  inherit src; # Same as: `src = src;``

  npmDeps = importNpmLock {
    npmRoot = src;
  };

  npmConfigHook = importNpmLock.npmConfigHook;
}
