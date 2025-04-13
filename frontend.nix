{ buildNpmPackage, importNpmLock }:

buildNpmPackage {
  pname = "frontend";
  version = "0.0.0";
  src = ./nix-derivative-frontend/nix-derivative-frontend;

  npmDeps = importNpmLock {
    npmRoot = ./nix-derivative-frontend/nix-derivative-frontend;
  };

  npmConfigHook = importNpmLock.npmConfigHook;

  postInstall = ''
    echo "Here's the postInstall hook!!!" >&2
    cp -r dist/* "$out"/lib/node_modules/nix-derivative-frontend/
  '';
}
